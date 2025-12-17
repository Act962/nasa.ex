import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { ParticipantRole } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listParticipants = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/trackings/list-participants",
    summary: "List participants of a tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      participants: z.array(
        z.object({
          id: z.string(),
          createdAt: z.date(),
          userId: z.string(),
          trackingId: z.string(),
          role: z.custom<ParticipantRole>(),
          user: z.object({
            id: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            email: z.string(),
            emailVerified: z.boolean(),
            name: z.string(),
            image: z.string().nullable(),
          }),
        })
      ),
    })
  )
  .handler(async ({ errors, input }) => {
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

    const participants = await prisma.trackingParticipant.findMany({
      where: {
        trackingId: input.trackingId,
      },
      include: {
        user: true,
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    });

    return {
      participants,
    };
  });
