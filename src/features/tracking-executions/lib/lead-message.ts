/**
 * Mensagem do lead no payload dos gatilhos de workflow. Ver spec 0008.
 *
 * `leadMessage` significa SEMPRE o texto escrito pelo lead — nunca o do
 * atendente, nunca o da IA. Gatilhos que nascem de um inbound preenchem com a
 * mensagem do próprio evento (`TRIGGER_EVENT`); os demais buscam a última
 * inbound da conversa (`CONVERSATION_HISTORY`).
 */
import prisma from "@/lib/prisma";

/** O payload é re-serializado a cada step do Inngest — ver RNF-3 da spec. */
const MAX_TEXT_LENGTH = 2000;

export type LeadMessageSource = "TRIGGER_EVENT" | "CONVERSATION_HISTORY";

export type LeadMessageMediaType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker";

export type WorkflowLeadMessage = {
  /** Texto do lead. Vazio quando a mensagem é só mídia sem legenda. */
  text: string;
  messageId?: string;
  mediaType?: LeadMessageMediaType;
  /** ISO — payload do Inngest não preserva Date. */
  sentAt?: string;
  source: LeadMessageSource;
};

const LEAD_MESSAGE_MEDIA_TYPES: readonly LeadMessageMediaType[] = [
  "image",
  "video",
  "audio",
  "document",
  "sticker",
];

/**
 * `Message.mediaType` é String livre e carrega valores que não são mídia
 * ("location", "contact"). Guard pra só deixar passar o que o payload aceita.
 */
export function isLeadMessageMediaType(
  value: string | null | undefined,
): value is LeadMessageMediaType {
  return (
    value != null &&
    LEAD_MESSAGE_MEDIA_TYPES.includes(value as LeadMessageMediaType)
  );
}

export function truncateLeadMessageText(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

/**
 * Normalização usada nos dois lados da comparação do FILTER_LEAD: caixa,
 * acento e espaço. Sem isso "Olá" não casa com "ola" — que é como o lead
 * realmente digita no celular (D-4 da spec).
 */
export function normalizeLeadMessageText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tipos cujo `Message.body` NÃO é texto escrito pelo lead: contato guarda o
 * nome do cartão compartilhado, localização guarda "nome — endereço". Tratar
 * isso como mensagem faria um filtro casar com o nome de um contato que o lead
 * apenas encaminhou (spec 0008, CB-6).
 */
const NON_TEXT_MEDIA_TYPES = new Set(["contact", "location"]);

function toMediaType(mimetype: string | null): LeadMessageMediaType | undefined {
  if (!mimetype) return undefined;
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Quantas mensagens recentes olhamos pra trás procurando texto. Uma foto sem
 * legenda ou um cartão de contato não podem apagar o "quero orçamento" que o
 * lead escreveu logo antes — mas texto de 20 mensagens atrás já é contexto
 * velho demais pra decidir um fluxo, então a busca é limitada.
 */
const TEXT_LOOKBACK_LIMIT = 20;

/**
 * Última mensagem do lead que tem texto. Usada pelos gatilhos que não nascem de
 * uma mensagem (FIRST_CHAT_INTERACTION, LEAD_TAGGED, AI_FINISHED).
 *
 * O descarte de contato/localização acontece em memória, não no `where`: são
 * valores de uma coluna nullable, e depender da semântica de NULL do `notIn` do
 * Prisma aqui daria uma falha silenciosa (sempre `null`) difícil de enxergar em
 * produção.
 *
 * Best-effort por contrato (RNF-1): qualquer falha vira `null` e o gatilho
 * dispara sem a mensagem — nunca deixa de disparar. Chame só depois de
 * confirmar que existe workflow casando (RF-9), pra não pagar a query no hot
 * path de quem não usa o campo.
 */
export async function getLastLeadMessage(
  leadId: string,
): Promise<WorkflowLeadMessage | null> {
  try {
    const recentMessages = await prisma.message.findMany({
      where: {
        conversation: { leadId },
        fromMe: false,
        status: { not: "DELETED" },
        body: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: TEXT_LOOKBACK_LIMIT,
      select: {
        messageId: true,
        body: true,
        mediaType: true,
        mimetype: true,
        createdAt: true,
      },
    });

    const message = recentMessages.find(
      (candidate) =>
        !NON_TEXT_MEDIA_TYPES.has(candidate.mediaType ?? "") &&
        (candidate.body ?? "").trim() !== "",
    );

    if (!message) return null;

    const mediaType = toMediaType(message.mimetype);

    return {
      text: truncateLeadMessageText(message.body ?? ""),
      messageId: message.messageId,
      ...(mediaType ? { mediaType } : {}),
      sentAt: message.createdAt.toISOString(),
      source: "CONVERSATION_HISTORY",
    };
  } catch (err) {
    console.error("[lead-message] last_lead_message_failed", leadId, err);
    return null;
  }
}
