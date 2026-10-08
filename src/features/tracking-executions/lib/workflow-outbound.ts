/**
 * Caminho de envio de WhatsApp das automações (spec 0077). Os executores
 * resolvem o provedor do tracking pela mesma porta do chat, em vez de falar
 * com a Uazapi direto — é o que faz os workflows funcionarem na API Oficial.
 */
import "server-only";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import {
  isFreeFormWindowOpen,
  isFreeFormWindowOpenForPhone,
  toLegacyUazapiMessageId,
} from "@/features/tracking-chat/lib/providers/automated-outbound";
import {
  MetaFeatureUnsupportedError,
  OutboundProviderError,
  resolveOutboundProvider,
  type ResolvedOutboundProvider,
} from "@/features/tracking-chat/lib/providers";

export const WORKFLOW_TYPING_DELAY_MS = 2000;

export const WINDOW_CLOSED_MESSAGE =
  "A janela de 24h da API Oficial está fechada para este lead (ele não escreveu nas últimas 24h). " +
  'Use o tipo "Template" no passo Enviar Mensagem para falar com ele fora da janela.';

/**
 * Erro de provedor é definitivo (config, recurso não suportado, janela
 * fechada): tentar de novo só repete a falha, então vira `NonRetriableError`
 * com a mensagem legível no histórico da execução.
 */
export function toWorkflowSendError(error: unknown): unknown {
  if (error instanceof OutboundProviderError) {
    return new NonRetriableError(error.message, { cause: error });
  }
  return error;
}

export async function sendWithWorkflowErrors<SendOutput>(
  send: () => Promise<SendOutput>,
): Promise<SendOutput> {
  try {
    return await send();
  } catch (error) {
    throw toWorkflowSendError(error);
  }
}

export async function resolveWorkflowProvider(
  trackingId: string,
): Promise<ResolvedOutboundProvider> {
  return sendWithWorkflowErrors(() => resolveOutboundProvider(trackingId));
}

const NEW_LEAD_GRACE_MS = 60_000;
const WINDOW_RECHECK_DELAYS_MS = [1_000, 2_000];

type LeadRef = { leadId: string; trackingId: string };

/**
 * Janela de 24h do lead na API Oficial (Uazapi: sempre aberta).
 *
 * O gatilho "Novo lead" dispara antes de a mensagem que criou o lead ser
 * gravada na conversa. Para lead recém-criado **pelo WhatsApp** a checagem é
 * repetida por alguns segundos, senão a primeira resposta automática falharia
 * à toa. Lead de formulário/importação nunca escreveu: não há o que esperar.
 */
export async function isLeadWindowOpen(
  resolved: ResolvedOutboundProvider,
  lead: LeadRef,
): Promise<boolean> {
  if (resolved.providerId !== "meta-cloud") return true;

  const findConversationId = async () =>
    (
      await prisma.conversation.findFirst({
        where: { leadId: lead.leadId, trackingId: lead.trackingId },
        select: { id: true },
      })
    )?.id;

  if (await isFreeFormWindowOpen(resolved, await findConversationId())) {
    return true;
  }

  const leadRecord = await prisma.lead.findUnique({
    where: { id: lead.leadId },
    select: { createdAt: true, source: true },
  });
  const isNewLead =
    leadRecord !== null &&
    leadRecord.source === "WHATSAPP" &&
    Date.now() - leadRecord.createdAt.getTime() < NEW_LEAD_GRACE_MS;
  if (!isNewLead) return false;

  for (const delayMs of WINDOW_RECHECK_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (await isFreeFormWindowOpen(resolved, await findConversationId())) {
      return true;
    }
  }
  return false;
}

/**
 * A Meta costuma aceitar a chamada e só recusar depois, por webhook, quando a
 * janela está fechada — o passo ficaria "sucesso" sem a mensagem chegar. Por
 * isso a checagem é feita antes do envio (e antes de cobrar Stars).
 */
export async function assertFreeFormWindowOpenForLead(
  resolved: ResolvedOutboundProvider,
  lead: LeadRef,
): Promise<void> {
  if (await isLeadWindowOpen(resolved, lead)) return;
  throw new NonRetriableError(WINDOW_CLOSED_MESSAGE);
}

/** Janela para número customizado: vale a do lead dono daquele telefone. */
export async function isPhoneWindowOpen(
  resolved: ResolvedOutboundProvider,
  destination: { trackingId: string; phone: string },
): Promise<boolean> {
  return isFreeFormWindowOpenForPhone(resolved, destination);
}

/** `true` quando o texto livre não chegaria: API Oficial fora da janela. */
export async function isFreeFormWindowClosedForLead(
  lead: LeadRef,
): Promise<boolean> {
  const resolved = await resolveWorkflowProvider(lead.trackingId);
  return !(await isLeadWindowOpen(resolved, lead));
}

export interface UazapiCredentials {
  readonly token: string;
  readonly baseUrl: string | undefined;
}

export const VOICE_UNSUPPORTED_MESSAGE =
  "Áudio de voz gerado por IA ainda não é enviado pela API Oficial nas automações. Envie como texto ou template.";

/** Para o que ainda não está na porta e só existe na Uazapi (menu, voz). */
export function requireUazapiCredentials(
  resolved: ResolvedOutboundProvider,
  unsupportedMessage: string,
): UazapiCredentials {
  if (!resolved.uazapiToken) {
    throw new NonRetriableError(unsupportedMessage);
  }
  return { token: resolved.uazapiToken, baseUrl: resolved.uazapiBaseUrl };
}

export function requireUazapiMenuCredentials(
  resolved: ResolvedOutboundProvider,
): UazapiCredentials {
  return requireUazapiCredentials(
    resolved,
    new MetaFeatureUnsupportedError("buttons").message,
  );
}

export const toStoredMessageId = toLegacyUazapiMessageId;
