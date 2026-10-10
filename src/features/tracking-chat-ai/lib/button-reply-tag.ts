import prisma from "@/lib/prisma";
import { applyTagsByAi } from "./apply-tags-by-ai";

/**
 * Clique em botão ou linha de lista com tag associada (spec 0085, RF-9).
 *
 * A mensagem que levou o menu guarda `metadata.buttonTagMap` (botão → tag).
 * Na API oficial o clique traz o id da mensagem respondida; quando não traz,
 * vale a mensagem enviada mais recente cujo mapa contém exatamente o botão clicado.
 */

const RECENT_OUTBOUND_TO_SCAN = 20;

function tagIdFor(metadata: unknown, clickedButtonId: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const buttonTagMap = (metadata as { buttonTagMap?: Record<string, unknown> }).buttonTagMap;
  const tagId = buttonTagMap?.[clickedButtonId];
  return typeof tagId === "string" && tagId ? tagId : null;
}

export async function applyTagFromButtonReply(params: {
  leadId: string;
  conversationId: string;
  clickedButtonId: string | undefined;
  /** Id externo da mensagem que tinha o botão, quando o provider informa. */
  repliedMessageId?: string | null;
}): Promise<{ applied: boolean }> {
  if (!params.clickedButtonId) return { applied: false };

  let tagId: string | null = null;
  if (params.repliedMessageId) {
    const repliedMessage = await prisma.message.findFirst({
      where: { messageId: params.repliedMessageId, conversationId: params.conversationId },
      select: { metadata: true },
    });
    tagId = tagIdFor(repliedMessage?.metadata, params.clickedButtonId);
  }
  if (!tagId) {
    const recentOutbound = await prisma.message.findMany({
      where: { conversationId: params.conversationId, fromMe: true },
      orderBy: { createdAt: "desc" },
      take: RECENT_OUTBOUND_TO_SCAN,
      select: { metadata: true },
    });
    for (const outboundMessage of recentOutbound) {
      tagId = tagIdFor(outboundMessage.metadata, params.clickedButtonId);
      if (tagId) break;
    }
  }
  if (!tagId) return { applied: false };

  const alreadyTagged = await prisma.leadTag.findFirst({
    where: { leadId: params.leadId, tagId },
    select: { id: true },
  });
  // Clique repetido não redispara o fluxo da tag.
  if (alreadyTagged) return { applied: false };
  await applyTagsByAi({ leadId: params.leadId, tagIds: [tagId] });
  return { applied: true };
}
