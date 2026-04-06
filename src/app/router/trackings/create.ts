import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { logActivity } from "@/lib/activity-logger";

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
    }),
  )
  .output(
    z.object({
      trackingId: z.string(),
      trackingName: z.string(),
    }),
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
        aiSettings: {
          create: {
            assistantName: "John",
            prompt: `Você é a assistente de IA da ${input.name}`,
            finishSentence:
              "Quando o cliente quiser conversar com um consultou ou atendente humano",
          },
        },
      },
    });

    await logActivity({
      organizationId: org.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: (user as any).image,
      appSlug: "tracking",
      action: "tracking.created",
      actionLabel: `Criou o tracking "${tracking.name}"`,
      resource: tracking.name,
      resourceId: tracking.id,
    });

    return {
      trackingId: tracking.id,
      trackingName: tracking.name,
    };
  });
