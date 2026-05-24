/**
 * Cron: detect-whatsapp-ban (modo **RECOVERY**)
 *
 * Não roda health-check periódico em TODAS as instâncias — isso seria caro
 * pra uazapi (N instâncias × 12 ciclos/h × 24h). Em vez disso:
 *
 *  - **Detecção do ban**: feita push-based via 2 caminhos:
 *    1. Webhook `EventType: "connection"` do uazapi → `disconnected` →
 *       incrementa `inChatFailureCount`. Quando passa de 3, ativa modo.
 *    2. Falha em `sendText`/`sendMedia` (erro 401/500/timeout) →
 *       `markInstanceSendFailure()` faz a mesma coisa, lazy.
 *
 *  - **Esse cron** roda a cada **30 minutos** e SÓ checa instâncias que
 *    já estão em modo In-Chat ativo, pra detectar quando a uazapi voltou
 *    online (push de "connected" do uazapi nem sempre é confiável).
 *    Resultado: ~50× menos requisições que o cron antigo de 5min.
 *
 * Quando o status check sucede (CONNECTED): desativa o modo + zera o
 * contador. Quando ainda falha: mantém o modo + log.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
import {
  markInstanceConnectionFailure,
  markInstanceConnectionHealthy,
} from "@/features/tracking-chat/lib/in-chat-mode";

const HEALTH_CHECK_TIMEOUT_MS = 8_000;

export const detectWhatsappBan = inngest.createFunction(
  {
    id: "detect-whatsapp-ban",
    // Concorrência limitada — não martelar a uazapi com health checks
    // paralelos. Como rodamos só nas instâncias em modo In-Chat ativo
    // (subconjunto pequeno), 5 paralelos basta.
    concurrency: { limit: 5 },
    retries: 1,
  },
  { cron: "*/30 * * * *" }, // a cada 30 minutos (recovery-only)
  async ({ step, logger }) => {
    const instances = await step.run("fetch-in-chat-active", async () =>
      prisma.whatsAppInstance.findMany({
        // Modo RECOVERY: só checa instâncias que ESTÃO em In-Chat. As
        // saudáveis seguem normais; vai ser o webhook/send-failure que
        // detecta queda quando vier.
        where: { isActive: true, inChatModeActive: true },
        select: {
          id: true,
          apiKey: true,
          baseUrl: true,
        },
      }),
    );

    logger.info("[detect-whatsapp-ban] recovery check", {
      count: instances.length,
    });

    let recovered = 0;

    for (const inst of instances) {
      const isHealthy = await step.run(`check-${inst.id}`, async () => {
        try {
          // Timeout manual — uazapi às vezes pendura conexão.
          const status = await Promise.race([
            getInstanceStatus(inst.apiKey, inst.baseUrl ?? undefined),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("status-check timeout")),
                HEALTH_CHECK_TIMEOUT_MS,
              ),
            ),
          ]);
          const s = String((status as any)?.instance?.status ?? "").toLowerCase();
          return s === "connected";
        } catch (err) {
          logger.debug("[detect-whatsapp-ban] check failed", {
            instanceId: inst.id,
            error: err instanceof Error ? err.message : String(err),
          });
          return false;
        }
      });

      if (isHealthy) {
        const { deactivated } = await step.run(
          `recover-${inst.id}`,
          async () => markInstanceConnectionHealthy({ instanceId: inst.id }),
        );
        if (deactivated) recovered++;
      } else {
        // Mantém modo ativo + incrementa contador (útil pra métricas
        // futuras tipo "instância banida há X ciclos").
        await step.run(`mark-still-down-${inst.id}`, async () =>
          markInstanceConnectionFailure({
            instanceId: inst.id,
            source: "send_failure",
          }),
        );
      }
    }

    return {
      checkedInChat: instances.length,
      recovered,
    };
  },
);
