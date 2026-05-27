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
 * SEND_LINNKER — envia link público de página Linnker pro lead via
 * WhatsApp. Não cria recurso novo, só monta URL.
 *
 * URL: `/linnker/{slug}` (slug é unique global na LinnkerPage).
 */

export interface SendLinnkerData {
  linnkerPageId: string;
  messageTemplate?: string;
}

const DEFAULT_TEMPLATE =
  "Olá {{nome}}, aqui estão nossos links principais ({{linnker_nome}}): {{url}}";

export const sendLinnkerExecutor: NodeExecutor<SendLinnkerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-linnker", async () => {
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

      const page = await prisma.linnkerPage.findFirst({
        where: {
          id: data.linnkerPageId,
          organizationId: lead.tracking.organizationId,
          isPublished: true,
        },
        select: { id: true, title: true, slug: true },
      });
      if (!page) {
        throw new NonRetriableError(
          "Linnker page not found, not published, or not in lead's organization",
        );
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const url = `${baseUrl}/linnker/${page.slug}`;

      const template = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{linnker_nome}}": page.title,
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
