/**
 * Apoio aos envios automáticos (workflows, lembretes, IA, notificações) que
 * saem pelo provedor do tracking em vez de falar com a Uazapi direto
 * (spec 0077).
 */
import "server-only";
import prisma from "@/lib/prisma";
import { getCustomerWindow } from "../customer-window";
import type { ResolvedOutboundProvider } from "./resolve-outbound-provider";
import type { SendResult } from "./types";

export const WINDOW_CLOSED_SKIP_REASON = "meta_window_closed";

/**
 * Texto livre e mídia: sempre liberados na Uazapi; na API Oficial, só dentro
 * da janela de 24h. Sem conversa o lead nunca escreveu — janela fechada.
 *
 * A Meta costuma aceitar a chamada e só recusar depois, por webhook; por isso
 * quem envia confere antes, em vez de esperar o erro.
 */
export async function isFreeFormWindowOpen(
  resolved: ResolvedOutboundProvider,
  conversationId: string | null | undefined,
): Promise<boolean> {
  if (resolved.providerId !== "meta-cloud") return true;
  if (!conversationId) return false;
  const { withinWindow } = await getCustomerWindow(conversationId);
  return withinWindow;
}

const PHONE_MATCH_SUFFIX_LENGTH = 8;

/**
 * Janela de 24h para um telefone avulso (número customizado, destino digitado
 * no Astro): só está aberta se o número for de um lead do tracking que
 * escreveu nas últimas 24h. Uazapi: sempre aberta.
 */
export async function isFreeFormWindowOpenForPhone(
  resolved: ResolvedOutboundProvider,
  destination: { trackingId: string; phone: string },
): Promise<boolean> {
  if (resolved.providerId !== "meta-cloud") return true;
  const phoneDigits = toPhoneDigits(destination.phone);
  if (phoneDigits.length < PHONE_MATCH_SUFFIX_LENGTH) return false;

  const conversation = await prisma.conversation.findFirst({
    where: {
      trackingId: destination.trackingId,
      lead: { phone: { endsWith: phoneDigits.slice(-PHONE_MATCH_SUFFIX_LENGTH) } },
    },
    select: { id: true },
  });
  return isFreeFormWindowOpen(resolved, conversation?.id);
}

export const WINDOW_CLOSED_FOR_PHONE_MESSAGE =
  "Na API Oficial só dá para enviar texto a quem escreveu para a empresa nas últimas 24h, e esse número não escreveu. Nada foi enviado.";

/**
 * Os envios automáticos sempre gravaram o `messageid` curto da Uazapi; a
 * porta devolve o `id` composto. Mantém o valor antigo quando ele existe.
 */
export function toLegacyUazapiMessageId(sent: SendResult): string {
  const legacyMessageId = (sent.raw as { messageid?: unknown } | null)?.messageid;
  return typeof legacyMessageId === "string" && legacyMessageId.length > 0
    ? legacyMessageId
    : sent.externalMessageId;
}

/** JID de contato (`5586...@s.whatsapp.net`) ou telefone → só os dígitos. */
export function toPhoneDigits(chatIdOrPhone: string): string {
  return chatIdOrPhone.replace(/@.*/, "").replace(/\D/g, "");
}

/**
 * Aviso para quem não é o lead da conversa (telefone do lembrete, contato da
 * notificação de formulário, participante de workspace, notificação
 * administrativa). Na API Oficial esse número não tem janela de 24h aberta e
 * o template teria de ser o do próprio cliente — que esses avisos ainda não
 * deixam escolher. Então o aviso não é enviado (nem cobrado).
 */
export const NOTICE_NEEDS_CLIENT_TEMPLATE_REASON =
  "official_api_needs_client_template";

export const NOTICE_NEEDS_CLIENT_TEMPLATE_MESSAGE =
  "Na API Oficial, este aviso só pode sair por um template aprovado do próprio cliente. Nada foi enviado.";
