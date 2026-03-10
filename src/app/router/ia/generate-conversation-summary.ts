import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { streamToEventIterator } from "@orpc/client";
import dayjs from "dayjs";

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
      dateInit: z.string(),
      dateEnd: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const { conversationId, dateInit, dateEnd } = input;

    console.log("dateInit", dateInit, "dateEnd", dateEnd);

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        messages: {
          take: 20,
          where: {
            createdAt: {
              gte: new Date(dateInit),
              lte: new Date(dateEnd),
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    console.log("conversation", conversation);

    if (!conversation) {
      throw errors.NOT_FOUND({
        message: "Conversation not found",
      });
    }

    const messages = conversation.messages.map((message) => {
      return {
        body: message.body,
        mediaCaption: message.mediaCaption,
        mediaType: message.mediaType,
        fromMe: message.fromMe,
        senderName: message.fromMe
          ? message.senderName || "Atendente"
          : message.senderName || "Cliente",
        createdAt: message.createdAt,
      };
    });

    let lines: string[] = [];

    if (messages && messages.length > 0) {
      lines = messages.map((message) => {
        const role = message.fromMe ? "ATENDENTE" : "CLIENTE";

        let content = message.body?.trim();

        if (!content && message.mediaCaption) {
          content = message.mediaCaption;
        }

        if (!content && message.mediaType) {
          content = `[${message.mediaType}]`;
        }

        if (!content) {
          content = "[mensagem vazia]";
        }

        const time = dayjs(message.createdAt).format("DD/MM/YYYY HH:mm");

        return `[${role}] ${message.senderName} (${time}): ${content}`;
      });
    }

    const compiled = lines.join("\n");

    const system = [
      `
       Você é um assistente especializado em análise de conversas de atendimento ao cliente.

      Seu trabalho é analisar uma conversa entre um CLIENTE e um ATENDENTE e gerar um resumo claro e objetivo.

      Regras importantes:
      - Responda sempre em português.
      - Não invente informações que não estejam na conversa.
      - Ignore mensagens curtas sem significado relevante como "ok", "👍", "obrigado".
      - Seja direto e objetivo.
      - Não escreva frases de encerramento.
      - Não explique o que você fez.

      Considere:
      - CLIENTE: mensagens enviadas pelo cliente
      - ATENDENTE: mensagens enviadas pela empresa/sistema

      Estrutura obrigatória da resposta:

      Resumo da Conversa:
      Explique em 2 a 4 frases o contexto geral da conversa.

      Motivo do Contato:
      Explique qual foi o problema, dúvida ou solicitação do cliente.

      Principais Informações:
      Liste em tópicos as informações importantes mencionadas.

      Status da Conversa:
      Explique se o problema foi resolvido, está pendente ou não ficou claro.

      Próximas Ações (se houver):
      Liste possíveis ações necessárias.
      `,
    ].join("\n");

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system,
      messages: [
        {
          role: "user",
          content: `Analise a conversa abaixo e gere o resumo solicitado:\n\n${compiled}`,
        },
      ],
      temperature: 0.2,
    });

    return streamToEventIterator(result.toUIMessageStream());
  });
