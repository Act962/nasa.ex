import prisma from "@/lib/prisma";
import { createTRPCRouter, orgProtectedProcedure } from "@/trpc/init";
import z from "zod";

export const trackingRouter = createTRPCRouter({
  create: orgProtectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await prisma.tracking.create({
        data: {
          name: input.name,
          description: input.description,
          organizationId: ctx.org.id,
          participants: {
            create: {
              userId: ctx.auth.user.id,
              role: "OWNER",
            },
          },
          status: {
            createMany: {
              data: [
                {
                  name: "Início",
                  color: "#FF0000",
                },
                {
                  name: "Em andamento",
                  color: "#FFA500",
                },
                {
                  name: "Fim",
                  color: "#00FF00",
                },
              ],
            },
          },
          winLossReasons: {
            createMany: {
              data: [
                {
                  name: "Atendimento",
                  type: "WIN",
                },
                {
                  name: "Produto flexível",
                  type: "WIN",
                },
                {
                  name: "Preço acessível",
                  type: "WIN",
                },
                {
                  name: "Atendimento ruim",
                  type: "LOSS",
                },
                {
                  name: "Produto não atendeu",
                  type: "LOSS",
                },
                {
                  name: "Não atendeu",
                  type: "LOSS",
                },
              ],
            },
          },
        },
      });
    }),
  getMany: orgProtectedProcedure.query(async ({ ctx }) => {
    return await prisma.tracking.findMany({
      where: {
        organizationId: ctx.org.id,
      },
    });
  }),
  getOne: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await prisma.tracking.findUnique({
        where: {
          id: input.id,
        },
      });
    }),
});
