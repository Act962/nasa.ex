import prisma from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";

export const trackingRoutes = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        description: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return prisma.tracking.create({
        data: {
          name: input.name,
          description: input.description,
          participants: {
            create: {
              userId: ctx.auth.user.id,
            },
          },
        },
      });
    }),
  getMany: protectedProcedure.query(({ ctx }) => {
    return prisma.tracking.findMany({
      where: {
        participants: {
          some: {
            userId: ctx.auth.user.id,
          },
        },
      },
    });
  }),
});
