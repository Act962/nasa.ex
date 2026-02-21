import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamToEventIterator } from "@orpc/client";
import prisma from "@/lib/prisma";

const openrouter = createOpenRouter({
  apiKey: process.env.LLM_KEY,
});

const MODEL_ID = "z-ai/glm-4.5-air:free";

const model = openrouter.chat(MODEL_ID);

export const generateCompose = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/ai/compose/generate",
    summary: "Compose message",
    tags: ["AI"],
  })
  .input(
    z.object({
      content: z.string(),
      conversationId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { content, conversationId } = input;

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        trackingId: true,
      },
    });

    if (!conversation) {
      throw errors.NOT_FOUND({
        message: "Conversa não encontrada",
      });
    }

    const aiSettings = await prisma.aiSettings.findUnique({
      where: {
        trackingId: conversation.trackingId,
      },
    });

    if (!aiSettings) {
      throw errors.NOT_FOUND({
        message: "Configurações de IA não encontradas",
      });
    }

    const system = [
      "Você é uma IA que ajuda os usuários a responderem mensagens de forma mais eficiente.",
      `Seu nome é ${aiSettings.assistantName}.`,
      "Sua mensagem deve ser curta e objetiva.",
      "## Contexto (Use para saber sobre como se comportar e como responder)",
      `${aiSettings.prompt}`,
      "Retorne SOMENTE o texto, nas apresentações ou frases de encerramento",
      "Use emojis de forma moderada",
    ].join("\n");

    const result = streamText({
      model,
      system,
      messages: [
        {
          role: "user",
          content:
            "Por favor, crie uma responsta para a seguinte mensagem: \n\n",
        },
        {
          role: "user",
          content,
        },
      ],
    });

    return streamToEventIterator(result.toUIMessageStream());
  });
