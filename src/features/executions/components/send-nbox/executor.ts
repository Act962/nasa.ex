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
import { randomBytes } from "crypto";

/**
 * SEND_NBOX — garante que o `NBoxItem` está público (gera `publicToken`
 * se faltar) e envia link de download pro lead via WhatsApp.
 *
 * URL: `/api/nbox/public/{publicToken}` — endpoint público que serve o
 * arquivo (download direto ou view). Token base64url cripto-seguro
 * (16 bytes) — unguessable.
 */

export interface SendNboxData {
  nboxItemId: string;
  messageTemplate?: string;
}

const DEFAULT_TEMPLATE =
  "Olá {{nome}}, segue o arquivo {{arquivo_nome}}: {{url}}";

function generatePublicToken(): string {
  return randomBytes(16).toString("base64url");
}

export const sendNboxExecutor: NodeExecutor<SendNboxData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-nbox", async () => {
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

      const item = await prisma.nBoxItem.findFirst({
        where: {
          id: data.nboxItemId,
          organizationId: lead.tracking.organizationId,
        },
        select: {
          id: true,
          name: true,
          mimeType: true,
          isPublic: true,
          publicToken: true,
        },
      });
      if (!item) {
        throw new NonRetriableError(
          "N-Box item not found or not in lead's organization",
        );
      }

      // Garante público + token. Se já público com token → reusa.
      let publicToken = item.publicToken;
      if (!item.isPublic || !publicToken) {
        publicToken = generatePublicToken();
        await prisma.nBoxItem.update({
          where: { id: item.id },
          data: { isPublic: true, publicToken },
        });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const url = `${baseUrl}/api/nbox/public/${publicToken}`;

      const template = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{arquivo_nome}}": item.name,
        "{{arquivo_tipo}}": item.mimeType ?? "",
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
