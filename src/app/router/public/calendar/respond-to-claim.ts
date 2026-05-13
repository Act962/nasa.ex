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
 * Criador responde à reivindicação via magic-link (sem auth).
 *
 *  - ACCEPT: evento despublicado (`isPublic=false, publishedAt=null`)
 *  - REJECT: evento ganha banner "contestado" (`isDisputed=true`)
 *    e claim vira REJECTED → vai pra fila do admin
 *
 * Em ambos casos, notifica o claimant + grava resolução.
 */
export const respondToClaim = base
  .input(
    z.object({
      token: z.string().min(8),
      decision: z.enum(["ACCEPT", "REJECT"]),
      // Resposta obrigatória quando rejeita (justificativa)
      response: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    if (input.decision === "REJECT" && (!input.response || input.response.length < 10)) {
      throw errors.BAD_REQUEST({
        message: "Justificativa obrigatória ao rejeitar (mín. 10 caracteres).",
      });
    }

    const claim = await prisma.eventClaim.findUnique({
      where: { responseToken: input.token },
      select: {
        id: true,
        status: true,
        actionId: true,
        claimantEmail: true,
        claimantName: true,
        action: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            createdBy: true,
            creator: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!claim) {
      throw errors.NOT_FOUND({ message: "Token inválido ou reivindicação não encontrada." });
    }

    if (claim.status !== "PENDING") {
      throw errors.BAD_REQUEST({
        message: `Reivindicação já foi resolvida (${claim.status}).`,
      });
    }

    const now = new Date();

    if (input.decision === "ACCEPT") {
      // Aceita → despublica evento
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
            status: "ACCEPTED",
            resolvedAt: now,
            updatedAt: now,
          },
        }),
      ]);
    } else {
      // Rejeita → vira disputa
      const reason = `Criador contesta: "${(input.response ?? "").slice(0, 120)}"`;
      await prisma.$transaction([
        prisma.action.update({
          where: { id: claim.actionId },
          data: {
            isDisputed: true,
            disputeReason: reason,
          },
        }),
        prisma.eventClaim.update({
          where: { id: claim.id },
          data: {
            status: "REJECTED",
            creatorResponse: input.response,
            resolvedAt: now,
            updatedAt: now,
          },
        }),
      ]);
    }

    // Notifica claimant via email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await resend.emails.send({
        from: "Nasaex <noreply@notifications.nasaex.com>",
        to: claim.claimantEmail,
        subject:
          input.decision === "ACCEPT"
            ? `Reivindicação aceita — "${claim.action.title}"`
            : `Reivindicação contestada — "${claim.action.title}"`,
        react: ClaimResolutionEmail({
          claimantName: claim.claimantName,
          eventTitle: claim.action.title,
          decision: input.decision,
          creatorResponse: input.response ?? null,
          eventUrl: claim.action.publicSlug
            ? `${baseUrl}/calendario/evento/${claim.action.publicSlug}`
            : `${baseUrl}/calendario`,
        }),
      });
    } catch (e) {
      console.error("[respondToClaim] email claimant failed", e);
    }

    // Notifica admin in-app se rejeitou (vira disputa)
    if (input.decision === "REJECT") {
      try {
        // Notifica todos os usuários isSystemAdmin
        const admins = await prisma.user.findMany({
          where: { isSystemAdmin: true },
          select: { id: true },
        });
        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            type: NOTIF_TYPES.CUSTOM,
            title: `Disputa nova: "${claim.action.title}"`,
            body: `Criador rejeitou reivindicação de ${claim.claimantName}. Decisão admin pendente.`,
            appKey: "admin",
            actionUrl: `/admin/calendario/disputas`,
            metadata: { claimId: claim.id, actionId: claim.actionId },
          });
        }
      } catch (e) {
        console.error("[respondToClaim] admin notif failed", e);
      }
    }

    return {
      success: true,
      decision: input.decision,
      message:
        input.decision === "ACCEPT"
          ? "Você aceitou — evento foi despublicado."
          : "Sua contestação foi registrada. Admin vai decidir.",
    };
  });
