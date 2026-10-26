import "server-only";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { buildChargeUrl } from "@/features/payment/lib/charge-link";
import { formatCalendarDate } from "@/features/payment/lib/dates";
import { sendDunningWhatsApp } from "@/features/payment/server/messaging/send-dunning-whatsapp";
import { moveIntoBusinessHours } from "@/features/payment/server/dunning/schedule";
import {
  buildChargePixCode,
  getOpenAmountCents,
  sumOtherOverdueReceivablesCents,
} from "@/features/payment/server/charges/charge-details";

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
    // Ritmo por empresa (um número de cobranças por empresa): ~1 aviso a cada 3s. Sem isso, os
    // vencimentos do dia saem todos às 9h juntos — padrão que leva a Meta a banir número não oficial.
    throttle: { limit: 20, period: "1m", key: "event.data.organizationId" },
  },
  { event: "payment/dunning.fire" },
  async ({ event, step, logger }) => {
    const { entryId, stepId, organizationId, dueDateMs } = event.data as {
      entryId:        string;
      stepId:         string;
      organizationId: string;
      scheduledForMs: number;
      /** Ausente nos eventos agendados antes de o reagendamento existir. */
      dueDateMs?:     number;
    };

    // ── 1) Guard: ainda faz sentido disparar? ─────────────────────────────
    const guard = await step.run("guard", async () => {
      const [entry, dunStep, existing] = await Promise.all([
        prisma.paymentEntry.findUnique({
          where: { id: entryId },
          include: {
            contact: { select: { name: true, email: true, phone: true } },
            lead: { select: { name: true, email: true, phone: true } },
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
      // Régua trocada ou removida depois do agendamento: o evento da régua antiga não vale mais.
      if (entry.dunningRuleId !== dunStep.ruleId) return { skip: "rule-changed" as const };
      if (["PAID", "CANCELLED"].includes(entry.status)) {
        return { skip: "entry-terminal" as const };
      }
      // O vencimento mudou depois do agendamento: o evento das datas novas já foi enviado.
      if (dueDateMs !== undefined && entry.dueDate.getTime() !== dueDateMs) {
        return { skip: "due-date-changed" as const };
      }
      if (existing && existing.status !== "PENDING") {
        return { skip: "already-executed" as const };
      }
      // Cliente prometeu pagar: o aviso volta para o fim da pausa em vez de sair agora.
      if (entry.dunningPausedUntil && entry.dunningPausedUntil.getTime() > Date.now()) {
        return { skip: "paused" as const, pausedUntilMs: entry.dunningPausedUntil.getTime() };
      }
      if (await wasCustomerNotifiedTodayForAnotherEntry(entry)) {
        await prisma.paymentDunningExecution.upsert({
          where:  { entryId_stepId: { entryId, stepId } },
          create: {
            entryId,
            stepId,
            scheduledFor: new Date(event.data.scheduledForMs as number),
            status:       "SKIPPED",
            channel:      dunStep.channel,
            executedAt:   new Date(),
            errorMessage: "customer-already-notified-today",
          },
          update: { status: "SKIPPED", executedAt: new Date(), errorMessage: "customer-already-notified-today" },
        });
        return { skip: "customer-already-notified-today" as const };
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

    if (guard.skip === "paused") {
      const resumeAtMs = moveIntoBusinessHours(new Date(guard.pausedUntilMs)).getTime();
      await step.sendEvent("reschedule-after-pause", {
        name: "payment/dunning.fire",
        id: `dunning-${entryId}-${stepId}-${dueDateMs ?? "legacy"}-paused-${guard.pausedUntilMs}`,
        data: { entryId, stepId, organizationId, scheduledForMs: resumeAtMs, dueDateMs },
        ts: resumeAtMs,
      });
      logger.info("[dunning] paused, rescheduled", { entryId, stepId, resumeAtMs });
      return { skipped: "paused", resumeAtMs };
    }
    if (guard.skip) {
      logger.info(`[dunning] skip ${guard.skip}`, { entryId, stepId });
      return { skipped: guard.skip };
    }

    const { entry, step: dunStep, executionId } = guard;

    // ── 2) Render template com vars ─────────────────────────────────────
    // Contato do financeiro primeiro; sem e-mail ou telefone, os do lead (spec 0115, RF-12).
    const recipientName = entry.contact?.name ?? entry.lead?.name ?? "Cliente";
    const recipientEmail = entry.contact?.email || entry.lead?.email || null;
    const recipientPhone = entry.contact?.phone || entry.lead?.phone || null;

    const chargeVariables = await step.run("charge-variables", async () => {
      const openAmountCents = getOpenAmountCents(entry);
      const [pixCode, otherOverdueCents] = await Promise.all([
        buildChargePixCode({ organizationId, entryId, amountCents: openAmountCents }),
        sumOtherOverdueReceivablesCents(entry),
      ]);
      return {
        chargeUrl: buildChargeUrl(organizationId, entryId),
        pixCode: pixCode ?? "",
        otherOverdue: otherOverdueCents > 0 ? formatBrl(otherOverdueCents) : "",
      };
    });

    const valor = formatBrl(getOpenAmountCents(entry));
    const vencimento = formatCalendarDate(entry.dueDate);

    function interpolate(template: string) {
      return template
        .replace(/\{\{contato\}\}/g, recipientName)
        .replace(/\{\{valor\}\}/g, valor)
        .replace(/\{\{vencimento\}\}/g, vencimento)
        .replace(/\{\{empresa\}\}/g, entry.organization?.name ?? "")
        .replace(/\{\{descricao\}\}/g, entry.description)
        .replace(/\{\{(link_pagamento|boleto_link)\}\}/g, chargeVariables.chargeUrl)
        .replace(/\{\{pix_copia_e_cola\}\}/g, chargeVariables.pixCode)
        .replace(/\{\{outras_pendencias\}\}/g, chargeVariables.otherOverdue);
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
        if (!recipientEmail) {
          return { status: "FAILED" as const, reason: "contact-no-email", messageId: null };
        }
        try {
          const result = await resend.emails.send({
            from:    process.env.RESEND_FROM ?? "ÓRBITA <no-reply@nasaagents.com>",
            to:      recipientEmail,
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
        if (!recipientPhone) {
          return { status: "FAILED" as const, reason: "contact-no-phone", messageId: null };
        }
        // Pelo número das cobranças: texto livre na Uazapi ou com a janela de 24h aberta; fora dela,
        // no número oficial, o modelo aprovado do aviso (sem modelo, falha com o motivo).
        const result = await sendDunningWhatsApp({
          organizationId,
          phone: recipientPhone,
          text:  body,
          template: dunStep.whatsappTemplateName && dunStep.whatsappTemplateLanguage
            ? {
                name:           dunStep.whatsappTemplateName,
                language:       dunStep.whatsappTemplateLanguage,
                // A Meta recusa parâmetro vazio.
                bodyParameters: dunStep.whatsappTemplateParams.map((token) => interpolate(token).trim() || "-"),
              }
            : null,
        });
        if (!result.isSent) {
          return { status: "FAILED" as const, reason: result.reason, messageId: null };
        }
        return { status: "SENT" as const, messageId: result.externalMessageId, reason: null };
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
        userEmail: "system@ÓRBITA",
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

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const BRAZIL_UTC_OFFSET_HOURS = 3;
const HOUR_MS = 60 * 60 * 1000;

/** Um aviso por cliente por dia (spec 0115, RNF-2): outra cobrança dele já avisou hoje? */
async function wasCustomerNotifiedTodayForAnotherEntry(entry: {
  id: string;
  organizationId: string;
  contactId: string | null;
  leadId: string | null;
}): Promise<boolean> {
  const customerFilters = [
    ...(entry.contactId ? [{ contactId: entry.contactId }] : []),
    ...(entry.leadId ? [{ leadId: entry.leadId }] : []),
  ];
  if (customerFilters.length === 0) return false;

  const nowInBrazil = new Date(Date.now() - BRAZIL_UTC_OFFSET_HOURS * HOUR_MS);
  nowInBrazil.setUTCHours(0, 0, 0, 0);
  const startOfTodayInBrazil = new Date(nowInBrazil.getTime() + BRAZIL_UTC_OFFSET_HOURS * HOUR_MS);

  const sentToday = await prisma.paymentDunningExecution.findFirst({
    where: {
      status: "SENT",
      executedAt: { gte: startOfTodayInBrazil },
      entry: {
        organizationId: entry.organizationId,
        id: { not: entry.id },
        OR: customerFilters,
      },
    },
    select: { id: true },
  });
  return sentToday !== null;
}
