import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const getAiSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { trackingId } = input;

    // Sem conferir a empresa, o id de um tracking alheio bastaria para ler a configuração (spec 0088, S-3).
    const aiSettings = await prisma.aiSettings.findFirst({
      where: {
        trackingId,
        tracking: { organizationId: context.org.id },
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
