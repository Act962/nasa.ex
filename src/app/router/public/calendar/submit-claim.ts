import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { resend } from "@/lib/email/resend";
import { ClaimReceivedEmail } from "@/lib/email/templates/claim-received";
import {
  checkRateLimit,
  ONE_DAY_MS,
} from "@/features/public-calendar/utils/rate-limit";
import {
  createNotification,
  NOTIF_TYPES,
} from "@/features/admin/lib/notification-service";

/**
 * Reivindicação de evento público — qualquer um (auth ou não) pode
 * submeter dizendo "esse evento usa minha marca / sou eu o organizador".
 *
 * Fluxo:
 *  1. Rate-limit por IP (max 3 reivindicações/dia)
 *  2. Cria `EventClaim` com `expiresAt = now + 7 dias`
 *  3. Notifica criador in-app (`createNotification`)
 *  4. Envia email pro criador com magic-link `responseToken`
 *  5. Devolve `trackingToken` pro reivindicante (acompanhar futuro)
 *
 * Em paralelo: se 7 dias passam sem resposta, Inngest job
 * `auto-resolve-expired-claims` despublica o evento automaticamente.
 */
export const submitClaim = base
  .use(optionalAuthMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().email().max(200),
      reason: z.string().trim().min(20).max(2000),
      evidence: z
        .array(z.string().url())
        .max(10)
        .optional(),
      brandOrgId: z.string().optional().nullable(), // se claimant logado quer associar à sua org
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Rate-limit (IP + email pra evitar abuso). Em ausência de IP
    // (oRPC não expõe diretamente), usa email como fallback.
    const ipKey = (context.headers?.get?.("x-forwarded-for") || "anon").split(",")[0].trim();
    const rateKey = `claim:${ipKey}:${input.email.toLowerCase()}`;
    const rate = checkRateLimit(rateKey, 3, ONE_DAY_MS);
    if (!rate.allowed) {
      throw errors.TOO_MANY_REQUESTS({
        message: "Muitas reivindicações em pouco tempo. Tente em algumas horas.",
      });
    }

    const action = await prisma.action.findUnique({
      where: { id: input.actionId, isPublic: true },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        createdBy: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!action) {
      throw errors.NOT_FOUND({ message: "Evento não encontrado ou não é público." });
    }

    // Anti-abuso: claimant não pode reivindicar evento que ele mesmo criou.
    if (context.user?.id && context.user.id === action.createdBy) {
      throw errors.BAD_REQUEST({
        message: "Você é o criador deste evento — não precisa reivindicar.",
      });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const claim = await prisma.eventClaim.create({
      data: {
        actionId: action.id,
        claimantUserId: context.user?.id ?? null,
        claimantOrgId: input.brandOrgId ?? null,
        claimantEmail: input.email.toLowerCase(),
        claimantName: input.name,
        reason: input.reason,
        evidence: input.evidence ? (input.evidence as unknown as object) : undefined,
        expiresAt,
      },
      select: {
        id: true,
        responseToken: true,
        trackingToken: true,
        expiresAt: true,
      },
    });

    // Email pro criador (best-effort; falha não bloqueia a criação)
    if (action.creator?.email) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const responseUrl = `${baseUrl}/calendario/disputa/${claim.responseToken}`;
      try {
        await resend.emails.send({
          from: "Nasaex <noreply@notifications.nasaex.com>",
          to: action.creator.email,
          subject: `Reivindicação do evento "${action.title}"`,
          react: ClaimReceivedEmail({
            creatorName: action.creator.name ?? "criador",
            eventTitle: action.title,
            claimantName: input.name,
            claimantEmail: input.email,
            reason: input.reason,
            responseUrl,
            expiresAt: claim.expiresAt,
          }),
        });
      } catch (e) {
        console.error("[submitClaim] email failed", e);
      }
    }

    // Notificação in-app pro criador
    try {
      await createNotification({
        userId: action.createdBy,
        type: NOTIF_TYPES.CUSTOM,
        title: `Reivindicação no evento "${action.title}"`,
        body: `${input.name} reivindica este evento. Responda em 7 dias.`,
        appKey: "calendario",
        actionUrl: `/calendario/disputa/${claim.responseToken}`,
        metadata: {
          claimId: claim.id,
          actionId: action.id,
          claimantEmail: input.email,
        },
      });
    } catch (e) {
      console.error("[submitClaim] in-app notif failed", e);
    }

    return {
      claimId: claim.id,
      trackingToken: claim.trackingToken,
      expiresAt: claim.expiresAt,
      message:
        "Reivindicação enviada. O criador recebeu email e tem 7 dias pra responder.",
    };
  });
