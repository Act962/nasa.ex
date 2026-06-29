/**
 * In-Chat (fallback anti-ban) — detecção da queda + recuperação preguiçosa.
 *
 *
 *  1. `confirmDisconnectAndActivate` — disparada pelo webhook quando a uazapi
 *     manda `connection: disconnected`. Espera uma carência curta e confirma
 *     via `/instance/status` que a queda é sustentada (filtra blips de rede)
 *     antes de ativar o modo In-Chat.
 *
 *  2. `checkInChatRecovery` — checagem preguiçosa/sob demanda. Disparada
 *     quando o atendente reabre o chat com In-Chat ativo. Confirma se o
 *     WhatsApp voltou e desliga o modo. Tem `debounce` por instância pra não
 *     martelar a uazapi em reaberturas seguidas. (A recuperação no caso comum
 *     já acontece na hora pelo webhook `connection: connected`.)
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import {
  activateInChatMode,
  markInstanceConnectionHealthy,
} from "@/features/tracking-chat/lib/in-chat-mode";

/** Carência antes de confirmar a queda e ativar — filtra blips passageiros. */
const GRACE_WINDOW = "45s";
/** Debounce da checagem preguiçosa de recuperação, por instância. */
const RECOVERY_CHECK_DEBOUNCE = "3m";
/** Timeout manual do status check — a uazapi às vezes pendura a conexão. */
const STATUS_CHECK_TIMEOUT_MS = 8_000;

interface InstanceConnectionStatus {
  connected: boolean;
  loggedIn: boolean;
}

/**
 * Consulta o `/instance/status` com timeout manual e normaliza o retorno
 * pros dois sinais que importam: `connected` (socket com a uazapi) e
 * `loggedIn` (conta autenticada no WhatsApp — sinal forte de não-banido).
 */
async function fetchInstanceConnectionStatus(
  apiKey: string,
  baseUrl: string | null,
): Promise<InstanceConnectionStatus> {
  const statusResponse = await Promise.race([
    getInstanceStatus(apiKey, baseUrl ?? undefined),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("status-check timeout")),
        STATUS_CHECK_TIMEOUT_MS,
      ),
    ),
  ]);
  return {
    connected: !!statusResponse?.status?.connected,
    loggedIn: !!statusResponse?.status?.loggedIn,
  };
}

interface DisconnectedEventData {
  instanceId: string;
  trackingId?: string;
  apiKey: string;
  baseUrl: string | null;
  reason?: string | null;
}

export const confirmDisconnectAndActivate = inngest.createFunction(
  {
    id: "whatsapp-confirm-disconnect-and-activate",
    retries: 1,
    // 1 confirmação por instância — desconexões repetidas não duplicam.
    concurrency: { limit: 1, key: "event.data.instanceId" },
  },
  { event: "whatsapp/instance.disconnected" },
  async ({ event, step, logger }) => {
    const { instanceId, apiKey, baseUrl, reason } =
      event.data as DisconnectedEventData;

    // Carência: dá tempo de distinguir queda real de blip passageiro.
    await step.sleep("confirm-grace", GRACE_WINDOW);

    const isStillOffline = await step.run("confirm-still-offline", async () => {
      try {
        const currentStatus = await fetchInstanceConnectionStatus(
          apiKey,
          baseUrl,
        );
        return !(currentStatus.connected && currentStatus.loggedIn);
      } catch (statusError) {
        // Não deu pra confirmar — trata como offline (a instância caiu mesmo).
        logger.debug("[in-chat] confirm status check failed", {
          instanceId,
          error:
            statusError instanceof Error
              ? statusError.message
              : String(statusError),
        });
        return true;
      }
    });

    if (!isStillOffline) {
      return { outcome: "transient_blip" as const };
    }

    const { activated } = await step.run("activate-in-chat", async () =>
      activateInChatMode({
        instanceId,
        source: "webhook",
        reason: reason ?? null,
      }),
    );

    return { outcome: "activated" as const, activated };
  },
);

interface CheckRecoveryEventData {
  instanceId: string;
}

export const checkInChatRecovery = inngest.createFunction(
  {
    id: "whatsapp-check-in-chat-recovery",
    retries: 1,
    // Throttle: no máximo 1 checagem a cada 3min por instância, mesmo que o
    // atendente reabra o chat várias vezes seguidas.
    debounce: { period: RECOVERY_CHECK_DEBOUNCE, key: "event.data.instanceId" },
    concurrency: { limit: 1, key: "event.data.instanceId" },
  },
  { event: "whatsapp/instance.check-recovery" },
  async ({ event, step, logger }) => {
    const { instanceId } = event.data as CheckRecoveryEventData;

    const hasReconnected = await step.run("check-connection", async () => {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
        select: { apiKey: true, baseUrl: true, inChatModeActive: true },
      });
      // Já desligado (recuperou por outro caminho) ou inexistente — nada a fazer.
      if (!instance || !instance.inChatModeActive) return false;
      try {
        const currentStatus = await fetchInstanceConnectionStatus(
          requireUazapiToken(instance.apiKey),
          instance.baseUrl,
        );
        return currentStatus.connected && currentStatus.loggedIn;
      } catch (statusError) {
        logger.debug("[in-chat] recovery status check failed", {
          instanceId,
          error:
            statusError instanceof Error
              ? statusError.message
              : String(statusError),
        });
        return false;
      }
    });

    if (!hasReconnected) {
      return { outcome: "still_offline" as const };
    }

    await step.run("deactivate", async () =>
      markInstanceConnectionHealthy({ instanceId }),
    );

    return { outcome: "recovered" as const };
  },
);
