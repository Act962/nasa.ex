import "server-only";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { scheduleApprovalReminder } from "@/features/payment/server/dunning/schedule";
import { notifyApproversOfRequest } from "@/features/payment/server/approvals/notify-approvers";

/**
 * Event-driven (sem cron). Disparado por `inngest.send("payment/approval.reminder", { ts })`.
 *
 * Padrão de auto-reagendamento:
 *   1. Quando ApprovalRequest é criada → `scheduleApprovalReminder` envia 1 evento
 *      com `ts: now + notifyApproversAfterHours`.
 *   2. Inngest dorme até o ts → fire o handler.
 *   3. Handler lê o status atual da request:
 *      - APPROVED/REJECTED/CANCELLED → no-op (idempotente, custo zero pro Inngest).
 *      - PENDING → re-notifica aprovadores + agenda PRÓXIMO reminder com
 *        `retryCount+1` no ID (Inngest deduplica entre rounds).
 *
 * Limite de retries: 10 (suficiente pra ~10 dias com config padrão de 24h).
 * Após esse limite, para de re-agendar (evita loop infinito se ninguém atuar).
 *
 * Custo de execução: 0 quando ninguém solicita aprovação. 1 step run por
 * reminder efetivo. Não consome se quórum atingido antes do disparo.
 */
const MAX_RETRIES = 10;

export const paymentApprovalReminder = inngest.createFunction(
  {
    id: "payment-approval-reminder",
    concurrency: { limit: 5, key: "event.data.organizationId" },
  },
  { event: "payment/approval.reminder" },
  async ({ event, step, logger }) => {
    const { requestId, organizationId, retryCount } = event.data as {
      requestId:      string;
      organizationId: string;
      retryCount:     number;
    };

    // ── 1) Status atual ─────────────────────────────────────────────────
    const request = await step.run("load-request", async () => {
      return prisma.paymentApprovalRequest.findUnique({
        where: { id: requestId },
        include: {
          entry: { select: { description: true, amount: true, type: true } },
        },
      });
    });

    if (!request) {
      logger.info("[approval-reminder] request not found", { requestId });
      return { skipped: "request-not-found" };
    }

    if (request.status !== "PENDING") {
      logger.info("[approval-reminder] decided already, skip", {
        requestId,
        status: request.status,
      });
      return { skipped: "decided", status: request.status };
    }

    // ── 2) Re-notifica ──────────────────────────────────────────────────
    await step.run("renotify-approvers", async () => {
      await notifyApproversOfRequest({
        organizationId,
        requestId,
        entryId:       request.entryId,
        requestedById: request.requestedById,
        amount:        request.entry.amount,
        description:   `[Lembrete] ${request.entry.description}`,
        type:          request.entry.type as "PAYABLE" | "RECEIVABLE",
      });
    });

    // ── 3) Re-agenda próxima rodada se ainda dentro do limite ───────────
    if (retryCount + 1 < MAX_RETRIES) {
      const config = await step.run("load-config", async () => {
        return prisma.paymentGovernanceConfig.findUnique({
          where: { organizationId },
          select: { notifyApproversAfterHours: true },
        });
      });

      const delayHours = config?.notifyApproversAfterHours ?? 24;
      await step.run("reschedule", async () => {
        await scheduleApprovalReminder({
          requestId,
          organizationId,
          delayHours,
          retryCount: retryCount + 1,
        });
      });
    } else {
      logger.warn("[approval-reminder] MAX_RETRIES reached, stopping", {
        requestId,
        retryCount,
      });
    }

    return { renotified: true, retryCount, nextScheduled: retryCount + 1 < MAX_RETRIES };
  },
);
