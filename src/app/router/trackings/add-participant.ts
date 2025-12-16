import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ParticipantRole } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/trackings/add-participant",
    summary: "Add participant to tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
      participantId: z.string(),
      role: z.custom<ParticipantRole>(),
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
    const tracking = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!tracking) {
      throw errors.NOT_FOUND({
        message: "Tracking não encontrado",
      });
    }

    const participant = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: input.participantId,
          organizationId: context.org.id,
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!participant) {
      throw errors.NOT_FOUND({
        message: "Participante não encontrado",
      });
    }

    await prisma.trackingParticipant.create({
      data: {
        trackingId: tracking.id,
        userId: participant.userId,
        role: input.role,
      },
    });

    return {
      trackingName: tracking.name,
      participantName: participant.user.name,
      role: input.role,
    };
  });
