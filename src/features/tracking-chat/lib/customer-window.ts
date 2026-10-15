import "server-only";
import prisma from "@/lib/prisma";

/**
 * Janela de 24h de atendimento da Meta: texto livre e mídia só são aceitos até
 * 24h depois da última mensagem do lead. Fora dela, só template aprovado.
 */

export const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Mesmo valor de `CATALOG_ORDER_MESSAGE_PREFIX` (nerp-catalog/lib/order-channel.ts). */
const CATALOG_ORDER_MESSAGE_ID_PREFIX = "nerp-order-";

export interface CustomerWindow {
  readonly withinWindow: boolean;
  readonly lastInboundAt: Date | null;
  readonly expiresAt: Date | null;
}

export async function getCustomerWindow(
  conversationId: string,
): Promise<CustomerWindow> {
  const lastInbound = await prisma.message.findFirst({
    // Só vale o que chegou pelo WhatsApp: resposta pelo portal In-Chat e
    // conversa de Instagram/Facebook não abrem a janela da Meta.
    where: {
      conversationId,
      fromMe: false,
      viaInChat: false,
      conversation: { channel: "WHATSAPP" },
      // O pedido do Catálogo online entra como mensagem do cliente, mas não veio do WhatsApp.
      NOT: { messageId: { startsWith: CATALOG_ORDER_MESSAGE_ID_PREFIX } },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const lastInboundAt = lastInbound?.createdAt ?? null;
  const expiresAt = lastInboundAt
    ? new Date(lastInboundAt.getTime() + CUSTOMER_WINDOW_MS)
    : null;
  const withinWindow = expiresAt ? expiresAt.getTime() > Date.now() : false;

  return { withinWindow, lastInboundAt, expiresAt };
}
