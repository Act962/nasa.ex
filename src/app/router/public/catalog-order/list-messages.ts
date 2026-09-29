import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { findOrderByPublicToken } from "@/features/nerp-catalog/lib/portal-order";
import { CATALOG_NOTICE_KIND } from "@/features/nerp-catalog/lib/catalog-stages";

const MESSAGES_PAGE_SIZE = 60;

type PortalNotice = { noticeType: string; title: string; subtitle: string };

function toPortalNotice(metadata: unknown): PortalNotice | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  if (record.kind !== CATALOG_NOTICE_KIND) return null;
  if (typeof record.noticeType !== "string" || typeof record.title !== "string") return null;
  return { noticeType: record.noticeType, title: record.title, subtitle: typeof record.subtitle === "string" ? record.subtitle : "" };
}

export const listPublicCatalogOrderMessages = base
  .input(z.object({ token: z.string().min(16) }))
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    const conversationId = order?.lead.conversation?.id;
    if (!order || !conversationId) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });

    const messages = await prisma.message.findMany({
      where: { conversationId, status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
      take: MESSAGES_PAGE_SIZE,
      select: {
        id: true,
        body: true,
        fromMe: true,
        senderName: true,
        mediaType: true,
        mediaCaption: true,
        createdAt: true,
        metadata: true,
      },
    });
    // Só o aviso de etapa vai para o cliente; o resto do metadata é interno.
    return {
      messages: messages.reverse().map(({ metadata, ...message }) => ({ ...message, notice: toPortalNotice(metadata) })),
    };
  });
