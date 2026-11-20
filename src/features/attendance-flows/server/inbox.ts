import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Caixa de entrada do Fluxo de Atendimento (spec 0139, D-13). A espera do Inngest só vê mensagens que chegam depois que
// ela começa: a resposta que o cliente mandou enquanto o fluxo ainda enviava ficaria perdida. Por isso o roteador marca
// cada mensagem do lead que está no fluxo com a execução (`metadata.attendanceRunId`), e o motor consome as marcadas,
// uma por vez. A marca não depende de horário: o horário da mensagem vem do celular, em segundos.

const INBOX_KEY = "attendanceRunId";

/** Mesmo formato do evento `agent-workflow/message-incoming`. */
export interface PendingReply {
  messageText: string;
  messageId: string;
  interactiveReplyId?: string;
  mediaType?: string;
}

type MessageMetadata = Record<string, unknown>;

function metadataOf(value: Prisma.JsonValue | null): MessageMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as MessageMetadata) } : {};
}

/** Põe a mensagem na caixa da execução. O roteador chama quando o lead já está no fluxo (fora do bloco Atraso). */
export async function addToInbox(messageInternalId: string, runId: string): Promise<void> {
  const message = await prisma.message.findUnique({ where: { id: messageInternalId }, select: { metadata: true } });
  if (!message) return;
  await prisma.message.update({
    where: { id: messageInternalId },
    data: { metadata: { ...metadataOf(message.metadata), [INBOX_KEY]: runId } as Prisma.InputJsonValue },
  });
}

/** Primeira mensagem ainda não usada na caixa da execução, já tirada da caixa. */
export async function takePendingReply(runId: string): Promise<PendingReply | null> {
  const message = await prisma.message.findFirst({
    where: { fromMe: false, metadata: { path: [INBOX_KEY], equals: runId } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { messageId: true, body: true, mediaType: true, metadata: true },
  });
  if (!message) return null;
  await removeFromInbox(message.messageId);
  const interactiveReplyId = metadataOf(message.metadata).interactiveReplyId;
  return {
    messageText: message.body ?? "",
    messageId: message.messageId,
    ...(typeof interactiveReplyId === "string" ? { interactiveReplyId } : {}),
    ...(message.mediaType ? { mediaType: message.mediaType } : {}),
  };
}

/** Tira a mensagem da caixa, para a próxima espera não usá-la de novo. */
async function removeFromInbox(externalMessageId: unknown): Promise<void> {
  if (typeof externalMessageId !== "string" || !externalMessageId) return;
  const message = await prisma.message.findUnique({ where: { messageId: externalMessageId }, select: { metadata: true } });
  if (!message) return;
  const metadata = metadataOf(message.metadata);
  if (!(INBOX_KEY in metadata)) return;
  delete metadata[INBOX_KEY];
  await prisma.message.update({ where: { messageId: externalMessageId }, data: { metadata: metadata as Prisma.InputJsonValue } });
}
