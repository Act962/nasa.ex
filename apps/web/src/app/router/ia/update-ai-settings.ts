import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { encryptSecret, last4 } from "@/lib/crypto";
import prisma from "@/lib/prisma";
import { AiProvider } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

// `aiApiKey`:
//  - undefined  → mantém a key atual
//  - ""         → limpa (volta pro default NASA)
//  - "sk-..."   → cifra e substitui
const aiProviderEnum = z.nativeEnum(AiProvider);

export const updateAiSettings = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      aiEnabled: z.boolean(),
      assistantName: z.string().optional(),
      prompt: z.string().min(1, "Preencha um prompt para sua agente"),
      finishMessage: z.string().optional(),
      aiProvider: aiProviderEnum.nullable().optional(),
      aiModelId: z.string().nullable().optional(),
      aiApiKey: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const {
      trackingId,
      aiEnabled,
      prompt,
      assistantName,
      finishMessage,
      aiProvider,
      aiModelId,
      aiApiKey,
    } = input;

    // Estado atual pra validar combinações provider+key.
    const current = await prisma.aiSettings.findUnique({
      where: { trackingId },
      select: { aiApiKey: true, aiProvider: true },
    });

    const aiSettingsUpdate: Prisma.AiSettingsUpdateWithoutTrackingInput = {
      assistantName,
      finishSentence: finishMessage,
      prompt,
    };

    // Provider/model são opcionais: undefined = não mexer, null = limpar.
    if (aiProvider !== undefined) aiSettingsUpdate.aiProvider = aiProvider;
    if (aiModelId !== undefined) aiSettingsUpdate.aiModelId = aiModelId;

    if (aiApiKey !== undefined) {
      if (aiApiKey === "") {
        aiSettingsUpdate.aiApiKey = null;
        aiSettingsUpdate.aiApiKeyLast4 = null;
      } else {
        try {
          aiSettingsUpdate.aiApiKey = encryptSecret(aiApiKey);
          aiSettingsUpdate.aiApiKeyLast4 = last4(aiApiKey);
        } catch (err) {
          // Em geral cai aqui se AI_SECRETS_KEY não estiver setada no .env.
          console.error("[update-ai-settings] crypto error", err);
          throw errors.BAD_REQUEST({
            message:
              "Não foi possível salvar a API key (AI_SECRETS_KEY ausente no servidor). Avise o suporte.",
          });
        }
      }
    }

    // Se o usuário está ativando provider customizado, exige que exista key
    // (já cadastrada OU vinda neste payload). Senão a IA cairia em erro 401.
    const finalProvider =
      aiProvider !== undefined ? aiProvider : current?.aiProvider ?? null;
    const willHaveKey =
      aiApiKey !== undefined ? aiApiKey !== "" : Boolean(current?.aiApiKey);
    if (finalProvider && !willHaveKey) {
      throw errors.BAD_REQUEST({
        message:
          "Informe a API key para o provider selecionado, ou desative o modelo customizado.",
      });
    }

    const updateAiSettings = await prisma.tracking.update({
      where: {
        id: trackingId,
      },
      data: {
        globalAiActive: aiEnabled,
        aiSettings: {
          update: aiSettingsUpdate,
        },
      },
      select: {
        id: true,
        aiSettings: true,
      },
    });

    if (!updateAiSettings || !updateAiSettings.aiSettings) {
      throw errors.BAD_REQUEST({
        message: "Erro ao atualizar configurações da IA",
      });
    }

    // Não vaza ciphertext no retorno.
    const { aiApiKey: _omit, ...safeSettings } = updateAiSettings.aiSettings;
    return {
      trackingId: updateAiSettings.id,
      settings: {
        ...safeSettings,
        aiApiKeyConfigured: Boolean(updateAiSettings.aiSettings.aiApiKey),
      },
    };
  });
