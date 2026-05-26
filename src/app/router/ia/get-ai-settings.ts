import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getAiSettings = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { trackingId } = input;

    const aiSettings = await prisma.aiSettings.findUnique({
      where: {
        trackingId,
      },
      include: {
        tracking: {
          select: {
            globalAiActive: true,
          },
        },
      },
    });

    if (!aiSettings) {
      throw errors.NOT_FOUND({
        message: "Configurações da IA não encontrada",
      });
    }

    // Nunca expor `aiApiKey` (ciphertext) no payload. UI usa só `aiApiKeyLast4`
    // + `aiApiKeyConfigured` pra renderizar placeholder.
    const { aiApiKey, ...safeSettings } = aiSettings;
    return {
      settings: {
        ...safeSettings,
        aiApiKeyConfigured: Boolean(aiApiKey),
      },
    };
  });
