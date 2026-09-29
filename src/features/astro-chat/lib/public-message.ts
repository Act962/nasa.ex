import type { Prisma } from "@/generated/prisma/client";

/** Formato da mensagem entregue ao widget: só o que o visitante pode ver. */

export const publicMessageSelect = {
  id: true,
  body: true,
  fromMe: true,
  senderName: true,
  senderId: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

type PublicMessageRow = Prisma.MessageGetPayload<{ select: typeof publicMessageSelect }>;

export type PublicMessageAuthor = "visitor" | "astro" | "team";

export type PublicMessage = {
  id: string;
  body: string;
  author: PublicMessageAuthor;
  senderName: string | null;
  createdAt: string;
};

export function isAstroAuthoredMetadata(metadata: Prisma.JsonValue | null): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return metadata.astroChatAi === true;
}

export function toPublicMessage(row: PublicMessageRow): PublicMessage {
  const author: PublicMessageAuthor = !row.fromMe
    ? "visitor"
    : isAstroAuthoredMetadata(row.metadata)
      ? "astro"
      : "team";
  return {
    id: row.id,
    body: row.body ?? "",
    author,
    senderName: author === "visitor" ? null : row.senderName,
    createdAt: row.createdAt.toISOString(),
  };
}
