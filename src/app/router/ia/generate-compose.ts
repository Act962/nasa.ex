import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { streamText } from "ai";
import { streamToEventIterator } from "@orpc/client";
import prisma from "@/lib/prisma";
import { google } from "@ai-sdk/google";
import {
  buildBrandedContext,
  prependBrandToTextSystem,
} from "@/features/nasa-planner/lib/brand-context";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

export const generateCompose = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
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
  .handler(async ({ input, context, errors }) => {
    const { content, conversationId } = input;

    // Cobra 2★ antes de chamar Gemini — evita gastar token sem saldo.
    const charge = await chargeStarsByAction(context.org.id, "generate_compose", {
      userId: context.user.id,
      appSlug: "generate_compose",
      description: "Composição IA (Gemini)",
    });
    if (!charge.success) {
      throw errors.BAD_REQUEST({
        message: "Saldo de STARs insuficiente pra compor mensagem com IA (2★).",
        data: { code: "INSUFFICIENT_STARS" },
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        trackingId: true,
        tracking: { select: { organizationId: true } },
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

    const baseSystem = [
      "Você é uma IA que ajuda os usuários a responderem mensagens de forma mais eficiente.",
      `Seu nome é ${aiSettings.assistantName}.`,
      "Sua mensagem deve ser curta e objetiva.",
      "## Contexto (Use para saber sobre como se comportar e como responder)",
      `${aiSettings.prompt}`,
      "Retorne SOMENTE o texto, nas apresentações ou frases de encerramento",
      "Use emojis de forma moderada",
    ].join("\n");

    // Brand context: se a conversa tem tracking → org, injeta identidade
    // da marca (slogan, tom de voz, ICP, posicionamento) ANTES do system
    // prompt da IA. Garante que toda composição respeite a marca.
    const orgId = conversation.tracking?.organizationId ?? null;
    const brandCtx = orgId
      ? await buildBrandedContext(orgId)
      : null;
    const system = brandCtx
      ? prependBrandToTextSystem(baseSystem, brandCtx)
      : baseSystem;

    const result = streamText({
      model: google("gemini-2.5-flash"),
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
