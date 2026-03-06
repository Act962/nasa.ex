import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateAiSettings = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      aiEnabled: z.boolean(),
      assistantName: z.string().optional(),
      prompt: z.string().min(1, "Preencha um prompt para sua agente"),
      finishMessage: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { trackingId, aiEnabled, prompt, assistantName, finishMessage } =
      input;

    console.log("Inputs", input);

    const updateAiSettings = await prisma.tracking.update({
      where: {
        id: trackingId,
      },
      data: {
        globalAiActive: aiEnabled,
        aiSettings: {
          update: {
            assistantName,
            finishSentence: finishMessage,
            prompt,
          },
        },
      },
      select: {
        id: true,
        aiSettings: true,
      },
    });

    console.log("updateAiSettings", updateAiSettings);

    if (!updateAiSettings || !updateAiSettings.aiSettings) {
      throw errors.BAD_REQUEST({
        message: "Erro ao atualizar configurações da IA",
      });
    }

    return {
      trackingId: updateAiSettings.id,
      settings: updateAiSettings.aiSettings,
    };
  });
