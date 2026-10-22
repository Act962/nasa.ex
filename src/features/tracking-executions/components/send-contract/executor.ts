import { NodeExecutor } from "@/features/tracking-executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { LeadContext } from "../../schemas";
import { sendLinkToLead } from "../../lib/send-link-to-lead";
import {
  applyVariables,
  buildLeadVariables,
} from "../../lib/interpolate-message";
import { sendAppActionChannel } from "@/inngest/channels/send-app-action";
import { randomUUID } from "crypto";

/**
 * SEND_CONTRACT — clona um `ForgeContractTemplate` num novo `ForgeContract`
 * com o lead como primeiro signer, e envia link de assinatura via WhatsApp.
 *
 * Cada signer recebe um `token` UUID único embutido no JSON `signers`.
 * URL: `/contratos/assinar/{token}` — lead acessa sem autenticação.
 *
 * `value` do contrato vem do template (se houver) OU 0 — owner edita
 * depois no Forge se precisar.
 */

export type SendContractData = {
  templateContractId: string;
  messageTemplate?: string;
};

const DEFAULT_TEMPLATE =
  "Olá {{nome}}, segue o contrato nº {{contrato_numero}} pra sua assinatura: {{url}}";

interface Signer {
  name: string;
  email: string;
  whatsapp?: string;
  token: string;
  signed_at: string | null;
}

export const sendContractExecutor: NodeExecutor<SendContractData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-contract", async () => {
    const leadCtx = context.lead as LeadContext;
    const realTime = context.realTime as boolean;

    const lead = await prisma.lead.findUnique({
      where: { id: leadCtx.id },
      include: {
        status: true,
        tracking: { select: { name: true, organizationId: true } },
        responsible: { select: { name: true } },
      },
    });
    if (!lead) {
      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw new NonRetriableError("Lead not found");
    }

    try {
      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "loading" }),
        );
      }

      // 1. Valida template + ownership
      const template = await prisma.forgeContractTemplate.findFirst({
        where: {
          id: data.templateContractId,
          organizationId: lead.tracking.organizationId,
        },
        select: {
          id: true,
          name: true,
          content: true,
          defaultStartDate: true,
          defaultEndDate: true,
          createdById: true,
        },
      });
      if (!template) {
        throw new NonRetriableError(
          "Contract template not found or not in lead's organization",
        );
      }

      // 2. Lead vira signer principal (único). Token gerado pra URL de assinatura.
      const leadToken = randomUUID();
      const leadSigner: Signer = {
        name: lead.name,
        email: lead.email ?? "",
        whatsapp: lead.phone ?? undefined,
        token: leadToken,
        signed_at: null,
      };

      // 3. Datas: usa default do template OU now + 30 dias
      const now = new Date();
      const endDefault = new Date();
      endDefault.setDate(endDefault.getDate() + 30);
      const startDate = template.defaultStartDate ?? now;
      const endDate = template.defaultEndDate ?? endDefault;

      // 4. Cria contract com number sequencial atômico (mesmo padrão de
      //    createForgeContract em router/forge/contracts.ts)
      const contract = await prisma.$transaction(async (tx) => {
        const last = await tx.forgeContract.findFirst({
          where: { organizationId: lead.tracking.organizationId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        return tx.forgeContract.create({
          data: {
            organizationId: lead.tracking.organizationId,
            number,
            startDate,
            endDate,
            value: "0", // editável depois no Forge
            templateId: template.id,
            content: template.content,
            signers: [leadSigner] as unknown as object,
            createdById: template.createdById,
          },
          select: { id: true, number: true, value: true },
        });
      });

      // 5. URL + interpolação
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const url = `${baseUrl}/contratos/assinar/${leadToken}`;
      const templateStr = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{contrato_nome}}": template.name,
        "{{contrato_numero}}": String(contract.number),
        "{{valor}}": new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Number(contract.value ?? 0)),
      };
      const body = applyVariables(templateStr, variables);

      await sendLinkToLead({
        leadId: lead.id,
        trackingId: lead.trackingId,
        body,
      });

      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "success" }),
        );
      }
      return { ...context };
    } catch (error) {
      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw error;
    }
  });
};
