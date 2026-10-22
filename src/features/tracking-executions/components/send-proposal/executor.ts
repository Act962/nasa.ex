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

/**
 * SEND_PROPOSAL — cria uma `ForgeProposal` vinculada ao lead com
 * produtos + responsável + validade, e envia link público.
 *
 * O valor da proposta é a soma de `ForgeProduct.value × quantity` (todos
 * com quantidade 1 por default — pode ser editado depois no Forge).
 * Sem discount/finalValue na action: simplicidade pra MVP.
 *
 * Ownership: products precisam ser da mesma org do lead.
 * Number: computado por max+1 dentro de transação (mesmo padrão do
 * `createForgeProposal` em router/forge/proposals.ts).
 */

export type SendProposalData = {
  /** IDs de `ForgeProduct` a incluir. */
  productIds: string[];
  /** User responsável (ForgeProposal.responsibleId — required). */
  responsibleId: string;
  /** Dias de validade a partir de agora. Default 7. */
  validityDays?: number;
  messageTemplate?: string;
};

const DEFAULT_TEMPLATE =
  "Olá {{nome}}, sua proposta nº {{numero}} no valor de {{valor}}, válida até {{validade}}: {{url}}";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export const sendProposalExecutor: NodeExecutor<SendProposalData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-proposal", async () => {
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

      // 1. Valida produtos pertencem à org
      const products = await prisma.forgeProduct.findMany({
        where: {
          id: { in: data.productIds },
          organizationId: lead.tracking.organizationId,
        },
        select: { id: true, name: true, value: true },
      });
      if (products.length === 0) {
        throw new NonRetriableError("No products found in lead's organization");
      }

      // 2. Valida responsável da mesma org
      const responsible = await prisma.member.findFirst({
        where: {
          userId: data.responsibleId,
          organizationId: lead.tracking.organizationId,
        },
        select: { userId: true },
      });
      if (!responsible) {
        throw new NonRetriableError(
          "Responsible user not member of lead's organization",
        );
      }

      // 3. Validade
      const validityDays = data.validityDays ?? 7;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validityDays);

      // 4. Soma dos valores dos produtos (Decimal → number)
      const total = products.reduce((sum, p) => sum + Number(p.value ?? 0), 0);

      // 5. Cria proposal em transação (pra number sequencial atômico)
      const proposal = await prisma.$transaction(async (tx) => {
        const last = await tx.forgeProposal.findFirst({
          where: { organizationId: lead.tracking.organizationId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        return tx.forgeProposal.create({
          data: {
            organizationId: lead.tracking.organizationId,
            title: `Proposta para ${lead.name}`,
            number,
            clientId: lead.id,
            responsibleId: data.responsibleId,
            createdById: data.responsibleId,
            validUntil,
            products: {
              create: products.map((p, idx) => ({
                productId: p.id,
                quantity: 1,
                unitValue: p.value,
                order: idx,
              })),
            },
          },
          select: {
            id: true,
            number: true,
            publicToken: true,
            validUntil: true,
          },
        });
      });

      // 6. URL + interpolação
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const url = `${baseUrl}/propostas/public/${proposal.publicToken}`;
      const template = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{numero}}": String(proposal.number),
        "{{valor}}": formatBRL(total),
        "{{produtos}}": products.map((p) => p.name).join(", "),
        "{{validade}}": proposal.validUntil
          ? new Date(proposal.validUntil).toLocaleDateString("pt-BR")
          : "",
      };
      const body = applyVariables(template, variables);

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
