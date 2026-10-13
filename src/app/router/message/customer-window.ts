import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import { getCustomerWindow } from "@/features/tracking-chat/lib/customer-window";
import z from "zod";

/**
 * Estado da janela de 24h de atendimento da Meta (Fase 9).
 *
 * Só é aplicável a trackings `META_CLOUD` — na API Oficial, texto livre/mídia
 * só são aceitos dentro de 24h após a última mensagem do lead. Fora disso é
 * preciso enviar um template aprovado. Para Uazapi (ou outros), devolve
 * `applicable: false` e a UI não restringe nada.
 */

export const getCustomerWindowState = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/message/customer-window",
    summary: "Meta 24h customer service window state for a conversation",
  })
  .input(z.object({ conversationId: z.string() }))
  .handler(async ({ input, errors }) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        trackingId: true,
        tracking: {
          select: { whatsappInstance: { select: { provider: true } } },
        },
      },
    });

    if (!conversation) {
      throw errors.NOT_FOUND({ message: "Conversa não encontrada" });
    }

    const provider = conversation.tracking?.whatsappInstance?.provider;
    if (provider !== WhatsAppProvider.META_CLOUD) {
      return { applicable: false as const };
    }

    const { withinWindow, lastInboundAt, expiresAt } = await getCustomerWindow(
      input.conversationId,
    );

    return {
      applicable: true as const,
      withinWindow,
      lastInboundAt,
      expiresAt,
    };
  });
