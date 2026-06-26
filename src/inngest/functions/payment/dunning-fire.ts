import "server-only";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { resend } from "@/lib/email/resend";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Event-driven (sem cron). Disparado por `inngest.send("payment/dunning.fire", { ts })`.
 *
 * Idempotência multi-camadas:
 *   1. Dedup do Inngest pelo `event.id` no send (mesmo entry+step não agenda 2x).
 *   2. `PaymentDunningExecution.@@unique([entryId, stepId])` — mesmo se 2 eventos
 *      escaparem do dedup (race condition rara), só 1 cria a row.
 *   3. Handler checa entry status (PAID/CANCELLED → skip), rule.isActive,
 *      step.enabled antes de gastar comm.
 *
 * Step:
 *   - guard: lê DB, decide se ainda faz sentido disparar
 *   - send: chama EMAIL/WHATSAPP (SMS é SKIPPED no MVP — reservado pra Fase 2.5)
 *   - mark: cria PaymentDunningExecution(SENT|FAILED|SKIPPED) + logActivity
 *
 * Erros transitórios (5xx de uazapi, network) — Inngest retry default (3x).
 */
export const paymentDunningFire = inngest.createFunction(
  {
    id: "payment-dunning-fire",
    // Limita 5 envios simultâneos por org pra não estourar rate limit do uazapi.
    concurrency: { limit: 5, key: "event.data.organizationId" },
  },
  { event: "payment/dunning.fire" },
  async ({ event, step, logger }) => {
    const { entryId, stepId, organizationId } = event.data as {
      entryId:        string;
      stepId:         string;
      organizationId: string;
      scheduledForMs: number;
    };

    // ── 1) Guard: ainda faz sentido disparar? ─────────────────────────────
    const guard = await step.run("guard", async () => {
      const [entry, dunStep, existing] = await Promise.all([
        prisma.paymentEntry.findUnique({
          where: { id: entryId },
          include: {
            contact: { select: { name: true, email: true, phone: true } },
            organization: { select: { name: true } },
          },
        }),
        prisma.paymentDunningStep.findUnique({
          where: { id: stepId },
          include: { rule: { select: { isActive: true } } },
        }),
        prisma.paymentDunningExecution.findUnique({
          where: { entryId_stepId: { entryId, stepId } },
        }),
      ]);

      if (!entry) return { skip: "entry-not-found" as const };
      if (!dunStep || !dunStep.enabled) return { skip: "step-disabled" as const };
      if (!dunStep.rule.isActive) return { skip: "rule-inactive" as const };
      if (["PAID", "CANCELLED"].includes(entry.status)) {
        return { skip: "entry-terminal" as const };
      }
      if (existing && existing.status !== "PENDING") {
        return { skip: "already-executed" as const };
      }

      // Cria/atualiza execution(PENDING) — placeholder pra evitar dupes em race.
      const execution = await prisma.paymentDunningExecution.upsert({
        where:  { entryId_stepId: { entryId, stepId } },
        create: {
          entryId,
          stepId,
          scheduledFor: new Date(event.data.scheduledForMs as number),
          status:       "PENDING",
          channel:      dunStep.channel,
        },
        update: {},
      });

      return {
        skip: false as const,
        entry,
        step: dunStep,
        executionId: execution.id,
      };
    });

    if (guard.skip) {
      logger.info(`[dunning] skip ${guard.skip}`, { entryId, stepId });
      return { skipped: guard.skip };
    }

    const { entry, step: dunStep, executionId } = guard;

    // ── 2) Render template com vars ─────────────────────────────────────
    const valor = (entry.amount / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const vencimento = new Date(entry.dueDate).toLocaleDateString("pt-BR");
    const contatoNome = entry.contact?.name ?? "Cliente";

    function interpolate(template: string) {
      return template
        .replace(/\{\{contato\}\}/g, contatoNome)
        .replace(/\{\{valor\}\}/g, valor)
        .replace(/\{\{vencimento\}\}/g, vencimento)
        .replace(/\{\{empresa\}\}/g, entry.organization?.name ?? "")
        .replace(/\{\{descricao\}\}/g, entry.description);
    }

    const body = interpolate(dunStep.templateBody);
    const subject = dunStep.templateSubject
      ? interpolate(dunStep.templateSubject)
      : `Cobrança — ${entry.description}`;

    // ── 3) Envio por canal ──────────────────────────────────────────────
    const sendResult = await step.run("send-comm", async () => {
      if (dunStep.channel === "SMS") {
        // Reservado pra Fase 2.5
        return { status: "SKIPPED" as const, reason: "SMS not implemented", messageId: null };
      }
      if (dunStep.channel === "EMAIL") {
        if (!entry.contact?.email) {
          return { status: "FAILED" as const, reason: "contact-no-email", messageId: null };
        }
        try {
          const result = await resend.emails.send({
            from:    process.env.RESEND_FROM ?? "NASA <no-reply@nasaagents.com>",
            to:      entry.contact.email,
            subject,
            html:    body.replace(/\n/g, "<br/>"),
          });
          if (result.error) {
            return {
              status: "FAILED" as const,
              reason: result.error.message ?? "email-error",
              messageId: null,
            };
          }
          return {
            status: "SENT" as const,
            messageId: result.data?.id ?? null,
            reason: null,
          };
        } catch (err) {
          return {
            status: "FAILED" as const,
            reason: err instanceof Error ? err.message : "email-error",
            messageId: null,
          };
        }
      }
      if (dunStep.channel === "WHATSAPP") {
        if (!entry.contact?.phone) {
          return { status: "FAILED" as const, reason: "contact-no-phone", messageId: null };
        }
        try {
          const result = await sendWhatsAppText({
            organizationId,
            phone:   entry.contact.phone,
            message: body,
          });
          if (!result) {
            return { status: "FAILED" as const, reason: "no-connected-whatsapp-instance", messageId: null };
          }
          return { status: "SENT" as const, messageId: result.messageId, reason: null };
        } catch (err) {
          return {
            status: "FAILED" as const,
            reason: err instanceof Error ? err.message : "whatsapp-error",
            messageId: null,
          };
        }
      }
      return { status: "SKIPPED" as const, reason: "unknown-channel", messageId: null };
    });

    // ── 4) Marca execution ──────────────────────────────────────────────
    await step.run("mark-execution", async () => {
      await prisma.paymentDunningExecution.update({
        where: { id: executionId },
        data: {
          status:       sendResult.status,
          executedAt:   new Date(),
          errorMessage: sendResult.reason,
          messageId:    sendResult.messageId,
        },
      });
    });

    // ── 5) Audit log ────────────────────────────────────────────────────
    await step.run("audit", async () => {
      await logActivity({
        organizationId,
        userId:    "system",
        userName:  "Sistema (Régua de Cobrança)",
        userEmail: "system@nasa.ex",
        userImage: null,
        appSlug:    "payment",
        subAppSlug: "payment-dunning",
        featureKey: `payment.dunning.${sendResult.status.toLowerCase()}`,
        action:     `payment.dunning.${sendResult.status.toLowerCase()}`,
        actionLabel: `Régua enviou ${dunStep.channel} para "${entry.description}" — ${sendResult.status}`,
        resource:    entry.description,
        resourceId:  entryId,
        metadata: {
          stepId,
          channel: dunStep.channel,
          status: sendResult.status,
          reason: sendResult.reason,
          messageId: sendResult.messageId,
        },
      });
    });

    return {
      status: sendResult.status,
      channel: dunStep.channel,
      entryId,
      stepId,
    };
  },
);
