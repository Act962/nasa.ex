import "server-only";
import prisma from "@/lib/prisma";

/**
 * Janela de 24h de atendimento da Meta: texto livre e mídia só são aceitos até
 * 24h depois da última mensagem do lead. Fora dela, só template aprovado.
 */

export const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

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
