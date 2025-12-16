import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";

export const createTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Create a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { user, org } = context;

    const tracking = await prisma.tracking.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: org.id,
        participants: {
          create: {
            userId: user.id,
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

    return {
      trackingName: tracking.name,
    };
  });
