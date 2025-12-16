import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { ParticipantRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const removeParticipant = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/trackings/remove-participant",
    summary: "Remove participant from tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
      participantId: z.string(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
      participantName: z.string(),
      role: z.custom<ParticipantRole>(),
    })
  )
  .handler(async ({ context, errors, input }) => {
    const trackingParticipant = await prisma.trackingParticipant.findUnique({
      where: {
        userId_trackingId: {
          userId: input.participantId,
          trackingId: input.trackingId,
        },
      },
      include: {
        tracking: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!trackingParticipant) {
      throw errors.NOT_FOUND({
        message: "Participante não encontrado",
      });
    }

    await prisma.trackingParticipant.delete({
      where: {
        userId_trackingId: {
          userId: input.participantId,
          trackingId: input.trackingId,
        },
      },
    });

    return {
      trackingName: trackingParticipant.tracking.name,
      participantName: trackingParticipant.user.name,
      role: trackingParticipant.role,
    };
  });
