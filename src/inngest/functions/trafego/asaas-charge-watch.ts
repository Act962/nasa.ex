import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  notifyPixRescue,
  reconcileTrafegoPixPending,
} from "@/features/trafego/server/lib/reconcile-asaas-pix";

/**
 * Acompanha UMA cobrança PIX até ela resolver.
 *
 * Existe porque o webhook falha em silêncio: evento perdido, fila do Asaas
 * interrompida, Inngest fora do ar. Em todos esses casos o cliente pagou e o
 * pedido fica parado, e ninguém descobre até ele reclamar.
 *
 * É agendada por pedido, e não por cron, de propósito. Varredura de tempo custa
 * o mesmo com zero ou com mil vendas; aqui o custo acompanha a receita — um run
 * por cobrança, e quase todos morrem no primeiro checkpoint, porque o webhook
 * normalmente funciona.
 *
 * `step.sleep` não consome compute enquanto dorme e não conta na concorrência.
 *
 * Evento: `trafego/asaas.charge_created` — emitido em `createAsaasPixCharge`.
 */

/** Espaçamento proposital: o primeiro dá tempo ao webhook; o último pega quem
 *  pagou perto do vencimento. */
const CHECKPOINTS = [
  { id: "apos-15min", delay: "15m" },
  { id: "apos-2h", delay: "2h" },
  { id: "apos-24h", delay: "22h" },
  { id: "apos-48h", delay: "24h" },
] as const;

export const trafegoAsaasChargeWatch = inngest.createFunction(
  { id: "trafego-asaas-charge-watch", retries: 2 },
  { event: "trafego/asaas.charge_created" },
  async ({ event, step }) => {
    const { pendingId } = event.data as { pendingId: string };

    for (const checkpoint of CHECKPOINTS) {
      await step.sleep(`dorme-${checkpoint.id}`, checkpoint.delay);

      const settled = await step.run(`confere-${checkpoint.id}`, async () => {
        const outcome = await reconcileTrafegoPixPending(pendingId);

        // Webhook não entregou e a varredura salvou: isso é trilho quebrado,
        // não rotina. Alguém precisa olhar a fila no painel do Asaas.
        if (outcome.status === "confirmed" && outcome.rescued) {
          await notifyPixRescue({
            checked: 1,
            confirmed: 1,
            rescued: 1,
            stillOpen: 0,
            noCharge: 0,
            failed: 0,
          }).catch((error) =>
            console.error("[trafego/watch] aviso de resgate falhou:", error),
          );
        }

        return (
          outcome.status === "confirmed" ||
          outcome.status === "already_settled" ||
          outcome.status === "not_found" ||
          outcome.status === "gateway_off"
        );
      });

      if (settled) {
        return { pendingId, settledAt: checkpoint.id };
      }
    }

    // Quatro checkpoints sem pagamento: é cliente que desistiu, não falha.
    // O cron horário já marcou `EXPIRED`; aqui só encerramos o acompanhamento.
    const finalStatus = await step.run("status-final", () =>
      prisma.trafegoPendingPurchase
        .findUnique({ where: { id: pendingId }, select: { status: true } })
        .then((pending) => pending?.status ?? null),
    );

    return { pendingId, settledAt: null, finalStatus };
  },
);
