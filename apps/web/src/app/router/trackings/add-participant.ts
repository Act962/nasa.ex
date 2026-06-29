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
      participantIds: z.array(z.string()),
      role: z.custom<ParticipantRole>(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
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

    const participants = await prisma.member.findMany({
      where: {
        organizationId: context.org.id,
        userId: {
          in: input.participantIds,
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

    if (!participants) {
      throw errors.NOT_FOUND({
        message: "Participante não encontrado",
      });
    }

    await prisma.trackingParticipant.createMany({
      data: participants.map((participant) => ({
        trackingId: tracking.id,
        userId: participant.userId,
        role: input.role,
      })),
    });

    return {
      trackingName: tracking.name,
      role: input.role,
    };
  });
