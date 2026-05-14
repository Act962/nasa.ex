import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { ClaimResolutionEmail } from "@/lib/email/templates/claim-resolution";
import {
  createNotification,
  NOTIF_TYPES,
} from "@/features/admin/lib/notification-service";

/**
 * Cron diário (03:00 BRT = 06:00 UTC) que finaliza reivindicações
 * pendentes há mais de 7 dias sem resposta:
 *  - Marca status=EXPIRED
 *  - Despublica o evento (isPublic=false)
 *  - Notifica claimant ("aceito por inação")
 *  - Notifica criador ("seu evento foi despublicado")
 *
 * Idempotente: re-rodar não causa efeitos colaterais (filtra status=PENDING).
 */
export const autoResolveExpiredClaims = inngest.createFunction(
  { id: "calendar-auto-resolve-expired-claims", retries: 1 },
  { cron: "0 6 * * *" }, // 03:00 BRT
  async ({ step }) => {
    const now = new Date();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const expired = await step.run("fetch-expired", async () => {
      return prisma.eventClaim.findMany({
        where: {
          status: "PENDING",
          expiresAt: { lt: now },
        },
        select: {
          id: true,
          actionId: true,
          claimantEmail: true,
          claimantName: true,
          action: {
            select: {
              id: true,
              title: true,
              publicSlug: true,
              createdBy: true,
              user: { select: { email: true, name: true } },
            },
          },
        },
        take: 200,
      });
    });

    if (expired.length === 0) return { resolved: 0 };

    for (const claim of expired) {
      await step.run(`resolve-${claim.id}`, async () => {
        await prisma.$transaction([
          prisma.action.update({
            where: { id: claim.actionId },
            data: {
              isPublic: false,
              publishedAt: null,
              isDisputed: false,
              disputeReason: null,
            },
          }),
          prisma.eventClaim.update({
            where: { id: claim.id },
            data: {
              status: "EXPIRED",
              resolvedAt: now,
              updatedAt: now,
            },
          }),
        ]);

        // Email pro claimant
        try {
          await resend.emails.send({
            from: "Nasaex <noreply@notifications.nasaex.com>",
            to: claim.claimantEmail,
            subject: `Reivindicação aceita por inação — "${claim.action.title}"`,
            react: ClaimResolutionEmail({
              claimantName: claim.claimantName,
              eventTitle: claim.action.title,
              decision: "ACCEPT",
              creatorResponse: null,
              eventUrl: `${baseUrl}/calendario`,
            }),
          });
        } catch (e) {
          console.error("[auto-resolve] claimant email failed", e);
        }

        // Notif in-app pro criador
        try {
          await createNotification({
            userId: claim.action.createdBy,
            type: NOTIF_TYPES.CUSTOM,
            title: `"${claim.action.title}" foi despublicado`,
            body: `Você não respondeu à reivindicação em 7 dias. O evento foi removido do Calendário Público. Você pode republicar manualmente.`,
            appKey: "calendario",
            metadata: { claimId: claim.id, actionId: claim.actionId },
          });
        } catch (e) {
          console.error("[auto-resolve] creator notif failed", e);
        }
      });
    }

    return { resolved: expired.length };
  },
);
