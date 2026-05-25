import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * In-Chat Fallback — helpers de detecção + ativação do modo anti-ban.
 *
 * Quando uma `WhatsAppInstance.inChatModeActive` está `true`, mensagens
 * outbound do tracking-chat NÃO vão pra uazapi/WhatsApp. Em vez disso,
 * são persistidas no DB com `Message.viaInChat = true` e ficam visíveis
 * pro lead via página pública `/whatsapp/[orgSlug]`.
 *
 * Detecção do ban (push-based, sem cron periódico):
 *  1. **Webhook `connection`** do uazapi → quando `disconnected` chega,
 *     `markInstanceConnectionFailure` incrementa contador. Threshold de
 *     3 ativa o modo.
 *  2. **Falha em envio** (sendText/sendMedia com erro 401/500/timeout):
 *     mesma função, lazy detection. Custo zero — é falha que ia
 *     acontecer mesmo.
 *
 * Recovery: cron `detect-whatsapp-ban` (a cada 30min) checa SÓ instâncias
 * em modo ativo pra detectar quando voltam online.
 */

/** Threshold de falhas consecutivas antes de ativar o modo In-Chat. */
export const IN_CHAT_FAILURE_THRESHOLD = 3;

/**
 * Retorna `true` se a instância do tracking está em modo In-Chat ativo.
 * Cacheado por chamada via dataloader não — cada call é uma query.
 * É barato (índice em `inChatModeActive`).
 */
export async function isInChatModeActiveForTracking(
  trackingId: string,
): Promise<boolean> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: { inChatModeActive: true },
  });
  return !!instance?.inChatModeActive;
}

/**
 * Mesma checagem mas via `conversationId` — útil nas procedures de envio
 * que recebem só o id da conversa.
 */
export async function isInChatModeActiveForConversation(
  conversationId: string,
): Promise<boolean> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      tracking: {
        select: {
          whatsappInstance: { select: { inChatModeActive: true } },
        },
      },
    },
  });
  return !!conv?.tracking?.whatsappInstance?.inChatModeActive;
}

/**
 * Marca uma falha de conexão/auth na instância. Chamado em 2 lugares:
 *  - Webhook handler `EventType: "connection"` quando recebe
 *    `instance.status === "disconnected"` da uazapi.
 *  - Procedures de envio (sendText/sendMedia) quando o request lança
 *    erro de auth (401/403/500) ou timeout.
 *
 * Incrementa o contador `inChatFailureCount`. Quando passa de
 * `IN_CHAT_FAILURE_THRESHOLD` (3), ATIVA `inChatModeActive = true` +
 * loga atividade pra owners verem no feed.
 *
 * Idempotente — chamar 2x seguidas com instância já em modo ativo só
 * incrementa o contador (não duplica log nem reativa).
 *
 * Fire-and-forget: erros internos só logam, não derrubam o caller.
 */
export async function markInstanceConnectionFailure(params: {
  /** Pode receber instanceId direto OU apiKey (do webhook do uazapi). */
  instanceId?: string;
  apiKey?: string;
  source: "webhook" | "send_failure";
}): Promise<void> {
  try {
    const where = params.instanceId
      ? { id: params.instanceId }
      : params.apiKey
        ? { apiKey: params.apiKey }
        : null;
    if (!where) return;

    const instance = await prisma.whatsAppInstance.findUnique({
      where,
      select: {
        id: true,
        organizationId: true,
        phoneNumber: true,
        inChatModeActive: true,
        inChatFailureCount: true,
      },
    });
    if (!instance) return;

    const newCount = instance.inChatFailureCount + 1;
    const shouldActivate =
      newCount >= IN_CHAT_FAILURE_THRESHOLD && !instance.inChatModeActive;

    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        inChatFailureCount: newCount,
        ...(shouldActivate && {
          inChatModeActive: true,
          inChatActivatedAt: new Date(),
        }),
      },
    });

    if (shouldActivate) {
      logActivity({
        organizationId: instance.organizationId,
        userId: "system",
        userName: "Sistema",
        userEmail: "sistema@nasa",
        appSlug: "chat",
        subAppSlug: "in-chat",
        featureKey: "in_chat.activated",
        action: "in_chat.activated",
        actionLabel: `WhatsApp offline — modo In-Chat ativado (${instance.phoneNumber ?? "?"})`,
        resource: "whatsapp_instance",
        resourceId: instance.id,
        metadata: {
          phoneNumber: instance.phoneNumber,
          source: params.source,
          failureCount: newCount,
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[markInstanceConnectionFailure] failed", err);
  }
}

/**
 * Marca uma confirmação de conexão saudável. Chamado pelo cron de
 * recovery quando o health check retorna `connected`, ou pelo webhook
 * quando `instance.status === "connected"` chega.
 *
 * Zera o contador + desativa o modo In-Chat se estava ligado.
 */
export async function markInstanceConnectionHealthy(params: {
  instanceId?: string;
  apiKey?: string;
}): Promise<{ deactivated: boolean }> {
  try {
    const where = params.instanceId
      ? { id: params.instanceId }
      : params.apiKey
        ? { apiKey: params.apiKey }
        : null;
    if (!where) return { deactivated: false };

    const instance = await prisma.whatsAppInstance.findUnique({
      where,
      select: { id: true, inChatModeActive: true, inChatFailureCount: true },
    });
    if (!instance) return { deactivated: false };

    // No-op se já está no estado saudável zerado
    if (!instance.inChatModeActive && instance.inChatFailureCount === 0) {
      return { deactivated: false };
    }

    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        inChatFailureCount: 0,
        inChatModeActive: false,
        inChatActivatedAt: null,
      },
    });

    return { deactivated: instance.inChatModeActive };
  } catch (err) {
    console.warn("[markInstanceConnectionHealthy] failed", err);
    return { deactivated: false };
  }
}
