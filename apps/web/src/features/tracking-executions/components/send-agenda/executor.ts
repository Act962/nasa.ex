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
 * SEND_AGENDA — envia link público da agenda pro lead se agendar via
 * WhatsApp. Não cria recurso novo (Agenda já existe), só monta URL.
 */

export type SendAgendaData = {
  agendaId: string;
  messageTemplate?: string;
};

const DEFAULT_TEMPLATE =
  "Olá {{nome}}! Agende um horário com a gente em {{url}} ({{agenda_duracao}}).";

export const sendAgendaExecutor: NodeExecutor<SendAgendaData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-agenda", async () => {
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

      const agenda = await prisma.agenda.findFirst({
        where: {
          id: data.agendaId,
          organizationId: lead.tracking.organizationId,
        },
        select: { id: true, name: true, slug: true, slotDuration: true },
      });
      if (!agenda) {
        throw new NonRetriableError(
          "Agenda not found or not in lead's organization",
        );
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      // Link público da agenda — slug é cosmético; lead identifica
      // depois via phone.
      const url = `${baseUrl}/agendamento/${agenda.slug}?lead=${lead.id}`;

      const template = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{agenda_nome}}": agenda.name,
        "{{agenda_duracao}}": agenda.slotDuration
          ? `${agenda.slotDuration} min`
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
