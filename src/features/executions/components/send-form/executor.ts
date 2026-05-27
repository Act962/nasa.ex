import { NodeExecutor } from "@/features/executions/types";
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
 * SEND_FORM — cria uma `FormResponses` vinculada ao lead e envia o link
 * do formulário via WhatsApp pro lead preencher.
 *
 * Ownership check: form precisa pertencer à mesma organização do lead
 * (via `tracking.organizationId`) — defesa contra workflows que
 * referenciam recursos cross-org inadvertidamente.
 *
 * Idempotência: `step.run("send-form", ...)` faz cache no Inngest. Se
 * o executor falhar após criar `FormResponses` mas antes do envio,
 * retry pula recriação.
 */

export type SendFormData = {
  formId: string;
  messageTemplate?: string;
};

const DEFAULT_TEMPLATE =
  "Olá {{nome}}! Por favor preencha este formulário ({{form_nome}}): {{url}}";

export const sendFormExecutor: NodeExecutor<SendFormData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-form", async () => {
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

      // 1. Valida form + ownership
      const form = await prisma.form.findFirst({
        where: {
          id: data.formId,
          organizationId: lead.tracking.organizationId,
          published: true,
        },
        select: { id: true, name: true, description: true },
      });
      if (!form) {
        throw new NonRetriableError(
          "Form not found, not published, or not in lead's organization",
        );
      }

      // 2. Cria FormResponses vinculada ao lead (em branco)
      const response = await prisma.formResponses.create({
        data: {
          formId: form.id,
          leadId: lead.id,
          jsonResponse: "{}",
          labelManuallyEdited: false,
        },
        select: { id: true },
      });

      // 3. Monta URL pública
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const url = `${baseUrl}/formulario/${form.id}/${response.id}`;

      // 4. Interpola template (default ou custom)
      const template = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{form_nome}}": form.name,
        "{{form_descricao}}": form.description ?? "",
      };
      const body = applyVariables(template, variables);

      // 5. Envia via helper compartilhado
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
