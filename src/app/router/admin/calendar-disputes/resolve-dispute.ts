import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { resend } from "@/lib/email/resend";
import { ClaimResolutionEmail } from "@/lib/email/templates/claim-resolution";
import {
  createNotification,
  NOTIF_TYPES,
} from "@/features/admin/lib/notification-service";

/**
 * Admin resolve uma disputa (claim que o criador rejeitou).
 *
 *  - UPHOLD: marca aceita → despublica evento + status=ADMIN_RESOLVED
 *  - DISMISS: criador venceu → tira flag `isDisputed` + status=ADMIN_RESOLVED
 *
 * Notifica AMBAS as partes via email + in-app.
 */
export const resolveDispute = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      claimId: z.string(),
      decision: z.enum(["UPHOLD", "DISMISS"]),
      note: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const claim = await prisma.eventClaim.findUnique({
      where: { id: input.claimId },
      include: {
        action: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            createdBy: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!claim) {
      throw errors.NOT_FOUND({ message: "Reivindicação não encontrada." });
    }

    const now = new Date();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (input.decision === "UPHOLD") {
      // Admin manteve a reivindicação — despublica
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
            status: "ADMIN_RESOLVED",
            adminNote: input.note ?? "Admin manteve a reivindicação.",
            resolvedAt: now,
            resolvedByUserId: context.adminUser.id,
            updatedAt: now,
          },
        }),
      ]);
    } else {
      // Admin descartou a reivindicação — tira flag
      await prisma.$transaction([
        prisma.action.update({
          where: { id: claim.actionId },
          data: {
            isDisputed: false,
            disputeReason: null,
          },
        }),
        prisma.eventClaim.update({
          where: { id: claim.id },
          data: {
            status: "ADMIN_RESOLVED",
            adminNote: input.note ?? "Admin descartou a reivindicação.",
            resolvedAt: now,
            resolvedByUserId: context.adminUser.id,
            updatedAt: now,
          },
        }),
      ]);
    }

    // Notifica claimant
    try {
      await resend.emails.send({
        from: "Nasaex <noreply@notifications.nasaex.com>",
        to: claim.claimantEmail,
        subject:
          input.decision === "UPHOLD"
            ? `Reivindicação aceita por admin — "${claim.action.title}"`
            : `Reivindicação descartada por admin — "${claim.action.title}"`,
        react: ClaimResolutionEmail({
          claimantName: claim.claimantName,
          eventTitle: claim.action.title,
          decision: input.decision === "UPHOLD" ? "ACCEPT" : "REJECT",
          creatorResponse: input.note ?? null,
          eventUrl: claim.action.publicSlug
            ? `${baseUrl}/calendario/evento/${claim.action.publicSlug}`
            : `${baseUrl}/calendario`,
        }),
      });
    } catch (e) {
      console.error("[resolveDispute] email failed", e);
    }

    // Notifica criador in-app
    try {
      await createNotification({
        userId: claim.action.createdBy,
        type: NOTIF_TYPES.CUSTOM,
        title: `Disputa do "${claim.action.title}" foi resolvida`,
        body:
          input.decision === "UPHOLD"
            ? "Admin aceitou a reivindicação. Evento foi despublicado."
            : "Admin descartou a reivindicação. Evento continua publicado.",
        appKey: "calendario",
        metadata: { claimId: claim.id, actionId: claim.actionId },
      });
    } catch (e) {
      console.error("[resolveDispute] creator notif failed", e);
    }

    return {
      success: true,
      decision: input.decision,
    };
  });
