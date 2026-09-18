/**
 * Cron: trafego-pix-pending-sweep
 *
 * De hora em hora faz duas coisas, nesta ordem:
 *
 * 1. **Reconcilia** com o Asaas as cobranças PIX ainda abertas. É a rede de
 *    segurança do webhook: se o evento se perdeu, a fila foi interrompida ou o
 *    acompanhamento por pedido não chegou a ser agendado, é aqui que o
 *    pagamento é descoberto. Reusa este cron de propósito — varredura por tempo
 *    custa igual com zero ou mil vendas, e criar mais uma seria pagar duas
 *    vezes pela mesma varredura.
 *
 * 2. **Expira** as que passaram da validade sem pagamento. Não cancela nada:
 *    `confirmPix` continua aceitando pendência expirada, porque quem paga
 *    atrasado tem o dinheiro na nossa conta do mesmo jeito. O status serve para
 *    a fila da equipe separar o que esfriou.
 *
 * A ordem importa: reconciliar antes de expirar evita marcar como esfriada uma
 * cobrança que na verdade já estava paga.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  notifyPixRescue,
  reconcileStuckTrafegoPix,
} from "@/features/trafego/server/lib/reconcile-asaas-pix";

/** Cobrança recém-criada não entra: o webhook merece a chance de chegar. */
const MIN_AGE_MINUTES = 20;
/** Depois disso, cobrança aberta é cliente que desistiu, não falha nossa. */
const MAX_AGE_DAYS = 7;
const SWEEP_LIMIT = 100;

export const trafegoPixPendingSweep = inngest.createFunction(
  { id: "trafego-pix-pending-sweep", retries: 1 },
  { cron: "15 * * * *" },
  async ({ step }) => {
    const now = new Date();

    const reconciled = await step.run("reconcile-asaas", () =>
      reconcileStuckTrafegoPix({
        minAgeMinutes: MIN_AGE_MINUTES,
        maxAgeDays: MAX_AGE_DAYS,
        limit: SWEEP_LIMIT,
      }),
    );

    // Resgate aqui significa que o webhook não entregou. O pedido foi salvo,
    // mas alguém precisa olhar a fila antes do próximo cliente pagar e esperar.
    if (reconciled.rescued > 0 || reconciled.failed > 0) {
      await step.run("notify-rescue", () => notifyPixRescue(reconciled));
    }

    const result = await step.run("expire-pix-pendings", () =>
      prisma.trafegoPendingPurchase.updateMany({
        where: {
          paymentMethod: "PIX",
          status: "PENDING",
          pixExpiresAt: { lt: now },
        },
        data: { status: "EXPIRED" },
      }),
    );

    return {
      reconciled,
      expired: result.count,
      at: now.toISOString(),
    };
  },
);
