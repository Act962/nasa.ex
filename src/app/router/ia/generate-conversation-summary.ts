import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamToEventIterator } from "@orpc/client";

const openrouter = createOpenRouter({
  apiKey: process.env.LLM_KEY,
});

const MODEL_ID = "z-ai/glm-4.5-air:free";

const model = openrouter.chat(MODEL_ID);

export const generateConversationSummary = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/ai/conversation/summary",
    summary: "Generate conversation summary",
    tags: ["AI"],
  })
  .input(
    z.object({
      conversationId: z.string(),
      date: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { conversationId, date } = input;

    console.log("Data", date);

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        messages: {
          take: 20,
          where: {
            createdAt: {
              gte: new Date(date),
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      throw errors.NOT_FOUND({
        message: "Conversation not found",
      });
    }

    console.log("Conversation", conversation);

    const messages = conversation?.messages.map((message) => {
      return {
        body: message.body,
        fromMe: message.fromMe,
        createdAt: message.createdAt,
      };
    });

    let lines: string[] = [];

    if (messages && messages.length > 0) {
      lines = messages.map((message) => {
        return `${message.fromMe ? "Sistema" : "Cliente"}: ${message.body}`;
      });
    }

    const compiled = lines.join("\n");

    const system = [
      "Você é um assistente de suporte ao cliente.",
      "Ajude o cliente dando um resumo das conversas de hoje.",
      "Responde apenas em portugues.",
      "Estilo: Neutro, especifíco e consistente. Não adicione uma frase de encerramento.",
    ].join("\n");

    console.log("Complid", compiled);

    const result = streamText({
      model,
      system,
      messages: [
        {
          role: "user",
          content: compiled,
        },
      ],
      temperature: 0.2,
    });

    return streamToEventIterator(result.toUIMessageStream());
  });
