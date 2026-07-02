import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import {
  getWaba,
  getMessageAnalytics,
  getConversationAnalytics,
} from "@/http/whats-oficial";
import {
  resolveMetaCloudInstance,
  MetaCloudInstanceNotFoundError,
  MetaCloudBusinessAccountMissingError,
} from "@/features/whatsapp-analytics/server/lib/resolve-meta-cloud-instance";
import { getWhatsAppAnalyticsInputSchema } from "@/features/whatsapp-analytics/schema/get-whatsapp-analytics-input";
import type {
  WhatsAppAnalyticsReport,
  WhatsAppConversationCategory,
} from "@/features/whatsapp-analytics/types";

const META_INVALID_TOKEN_ERROR_CODE = 190;

function toUnixSeconds(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1000);
}

function toDateKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Consolida `analytics` (mensagens) + `conversation_analytics`
 * (conversas/custo) da Graph API num relatório único pronto pra UI.
 * Sem `template_analytics` nesta v1 — exige opt-in irreversível
 * (`is_enabled_for_insights=true`), fica pra fase futura.
 */
export const getWhatsAppAnalytics = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/whatsapp-analytics",
    summary: "Get WhatsApp Oficial (Meta Cloud) message/conversation analytics for a tracking",
  })
  .input(getWhatsAppAnalyticsInputSchema)
  .handler(async ({ input, errors, context }) => {
    const { org } = context;
    const { trackingId, startDate, endDate } = input;

    const tracking = await prisma.tracking.findFirst({
      where: { id: trackingId, organizationId: org.id },
      select: { id: true },
    });
    if (!tracking) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    let instance: Awaited<ReturnType<typeof resolveMetaCloudInstance>>;
    try {
      instance = await resolveMetaCloudInstance(trackingId);
    } catch (error) {
      if (error instanceof MetaCloudInstanceNotFoundError) {
        throw errors.NOT_FOUND({
          message: "Tracking sem instância WhatsApp Oficial (Meta Cloud) configurada.",
        });
      }
      if (error instanceof MetaCloudBusinessAccountMissingError) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message:
            "A instância WhatsApp Oficial não tem WABA (metaBusinessAccountId) configurado. Reconecte em Configurações → Integrações.",
        });
      }
      throw error;
    }

    const startUnix = toUnixSeconds(startDate);
    const endUnix = toUnixSeconds(endDate);

    try {
      const [waba, messageAnalytics, conversationAnalytics] =
        await Promise.all([
          getWaba({ wabaId: instance.wabaId, accessToken: instance.accessToken }),
          getMessageAnalytics({
            wabaId: instance.wabaId,
            accessToken: instance.accessToken,
            startUnix,
            endUnix,
          }),
          getConversationAnalytics({
            wabaId: instance.wabaId,
            accessToken: instance.accessToken,
            startUnix,
            endUnix,
          }),
        ]);

      const messagesByDayMap = new Map<
        string,
        { sent: number; delivered: number }
      >();
      for (const point of messageAnalytics.analytics?.data_points ?? []) {
        const date = toDateKey(point.start);
        const existing = messagesByDayMap.get(date) ?? { sent: 0, delivered: 0 };
        existing.sent += point.sent;
        existing.delivered += point.delivered;
        messagesByDayMap.set(date, existing);
      }
      const messagesByDay = Array.from(messagesByDayMap.entries())
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const conversationPoints =
        conversationAnalytics.conversation_analytics?.data.flatMap(
          (entry) => entry.data_points,
        ) ?? [];

      const byCategoryMap = new Map<
        WhatsAppConversationCategory,
        { conversations: number; cost: number }
      >();
      for (const point of conversationPoints) {
        const category = (point.conversation_category ??
          "SERVICE") as WhatsAppConversationCategory;
        const existing = byCategoryMap.get(category) ?? {
          conversations: 0,
          cost: 0,
        };
        existing.conversations += point.conversation;
        existing.cost += point.cost ?? 0;
        byCategoryMap.set(category, existing);
      }
      const conversationsByCategory = Array.from(byCategoryMap.entries()).map(
        ([category, values]) => ({ category, ...values }),
      );

      const summary: WhatsAppAnalyticsReport["summary"] = {
        sent: messagesByDay.reduce((total, day) => total + day.sent, 0),
        delivered: messagesByDay.reduce(
          (total, day) => total + day.delivered,
          0,
        ),
        conversations: conversationsByCategory.reduce(
          (total, category) => total + category.conversations,
          0,
        ),
        totalCost: conversationsByCategory.reduce(
          (total, category) => total + category.cost,
          0,
        ),
      };

      const report: WhatsAppAnalyticsReport = {
        currency: waba.currency ?? "USD",
        summary,
        messagesByDay,
        conversationsByCategory,
      };
      return report;
    } catch (error) {
      const metaError = (error as { metaError?: { code?: number } })
        ?.metaError;
      if (metaError?.code === META_INVALID_TOKEN_ERROR_CODE) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message:
            "Token de acesso Meta expirado ou inválido. Reconecte a instância em Configurações → Integrações.",
        });
      }
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
