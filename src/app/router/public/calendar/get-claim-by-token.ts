import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lê uma EventClaim por seu magic-token. Usado pela página
 * `/calendario/disputa/[token]` pra mostrar pro criador (ou claimant,
 * se vier via trackingToken) o estado da reivindicação.
 *
 * Sem auth — token é a credencial. Falha silenciosamente (NOT_FOUND)
 * se token não bate ou expirou.
 */
export const getClaimByToken = base
  .input(
    z.object({
      token: z.string().min(8),
      // Distingue "responseToken" (visão do criador, vê botões aceitar/
      // rejeitar) de "trackingToken" (visão do claimant, só leitura).
      mode: z.enum(["respond", "track"]).default("respond"),
    }),
  )
  .handler(async ({ input, errors }) => {
    const tokenField =
      input.mode === "respond" ? "responseToken" : "trackingToken";

    const claim = await prisma.eventClaim.findFirst({
      where: { [tokenField]: input.token },
      select: {
        id: true,
        status: true,
        claimantEmail: true,
        claimantName: true,
        reason: true,
        evidence: true,
        creatorResponse: true,
        expiresAt: true,
        createdAt: true,
        resolvedAt: true,
        action: {
          select: {
            id: true,
            title: true,
            description: true,
            publicSlug: true,
            coverImage: true,
            startDate: true,
            endDate: true,
            city: true,
            state: true,
            isPublic: true,
            isDisputed: true,
            createdBy: true,
            user: {
              select: { name: true, email: true },
            },
            organization: {
              select: { name: true, isVerified: true, logo: true },
            },
          },
        },
      },
    });

    if (!claim) {
      throw errors.NOT_FOUND({ message: "Reivindicação não encontrada." });
    }

    return {
      claim,
      mode: input.mode,
    };
  });
