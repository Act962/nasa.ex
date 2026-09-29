// Dispara os Gatilhos do lead vencidos (spec 0038, RF-5/RF-6, RNF-1/RNF-2).

import "server-only";
import prisma from "@/lib/prisma";
import { nextWindowOpening } from "./schedule";
import { renderTriggerMessage } from "./templates";

const BATCH_LIMIT = 100;
const MAX_SEND_FAILURES = 3;
const RETRY_DELAY_MS = 10 * 60_000;
/** Lead ainda sem a tag exigida: confere de novo em 1 h (a tag pode chegar depois). */
const TAG_RETRY_DELAY_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

type TriggerOutcome = "sent" | "rescheduled" | "failed" | "skipped";

async function sendToLead(trackingId: string, phone: string, body: string): Promise<void> {
  const { resolveOutboundProviderOrBadRequest } = await import("@/features/tracking-chat/lib/providers");
  const resolved = await resolveOutboundProviderOrBadRequest(trackingId);
  await resolved.provider.sendText({ kind: "text", to: phone, body });
}

async function fireTrigger(triggerId: string, now: Date): Promise<TriggerOutcome> {
  const trigger = await prisma.leadTrigger.findUnique({
    where: { id: triggerId },
    select: {
      id: true,
      message: true,
      nextRunAt: true,
      windowStart: true,
      windowEnd: true,
      weekdays: true,
      skipWhenInService: true,
      failureCount: true,
      repeatEveryDays: true,
      maxRepetitions: true,
      cycleFireCount: true,
      tagIds: true,
      lead: {
        select: {
          name: true,
          phone: true,
          email: true,
          trackingId: true,
          statusFlow: true,
          responsible: { select: { name: true } },
          leadTags: { select: { tagId: true } },
        },
      },
    },
  });
  if (!trigger?.nextRunAt) return "skipped";

  const window = { windowStart: trigger.windowStart, windowEnd: trigger.windowEnd, weekdays: trigger.weekdays };
  const opening = nextWindowOpening(now, window);
  const isBlockedByService = trigger.skipWhenInService && trigger.lead.statusFlow === "ACTIVE";
  const leadTagIds = new Set(trigger.lead.leadTags.map((leadTag) => leadTag.tagId));
  const isMissingTag = trigger.tagIds.length > 0 && !trigger.tagIds.some((tagId) => leadTagIds.has(tagId));
  if (!opening || opening.getTime() > now.getTime() || isBlockedByService || isMissingTag) {
    // Fora da janela, em atendimento ou sem a tag exigida: adia (CA-3, CA-4, CA-6).
    const retryAt = isMissingTag
      ? new Date(now.getTime() + TAG_RETRY_DELAY_MS)
      : isBlockedByService
        ? new Date(now.getTime() + RETRY_DELAY_MS)
        : opening;
    await prisma.leadTrigger.updateMany({
      where: { id: trigger.id, nextRunAt: trigger.nextRunAt },
      data: retryAt ? { nextRunAt: retryAt } : { isActive: false, nextRunAt: null, lastError: "A janela de ativação nunca abre." },
    });
    return "rescheduled";
  }

  // Reserva atômica: só quem troca o `nextRunAt` visto envia (RNF-1, CA-5).
  const claimed = await prisma.leadTrigger.updateMany({
    where: { id: trigger.id, isActive: true, nextRunAt: trigger.nextRunAt },
    data: { nextRunAt: null },
  });
  if (claimed.count === 0) return "skipped";

  if (!trigger.lead.phone) {
    await prisma.leadTrigger.update({
      where: { id: trigger.id },
      data: { isActive: false, lastError: "Lead sem telefone." },
    });
    return "failed";
  }

  try {
    await sendToLead(
      trigger.lead.trackingId,
      trigger.lead.phone,
      renderTriggerMessage(trigger.message, {
        name: trigger.lead.name,
        phone: trigger.lead.phone,
        email: trigger.lead.email,
        responsibleName: trigger.lead.responsible?.name,
      }),
    );
  } catch (error) {
    const failureCount = trigger.failureCount + 1;
    const hasAttemptsLeft = failureCount < MAX_SEND_FAILURES;
    await prisma.leadTrigger.update({
      where: { id: trigger.id },
      data: {
        failureCount,
        lastError: error instanceof Error ? error.message : "O WhatsApp recusou o envio.",
        isActive: hasAttemptsLeft,
        nextRunAt: hasAttemptsLeft ? new Date(now.getTime() + RETRY_DELAY_MS) : null,
      },
    });
    return "failed";
  }

  // Repete "a cada X dias" até completar as repetições do ciclo (RF-6).
  const cycleFireCount = trigger.cycleFireCount + 1;
  const nextRepetitionAt =
    trigger.repeatEveryDays && cycleFireCount < trigger.maxRepetitions
      ? nextWindowOpening(new Date(now.getTime() + trigger.repeatEveryDays * DAY_MS), window)
      : null;
  await prisma.leadTrigger.update({
    where: { id: trigger.id },
    data: {
      isActive: nextRepetitionAt !== null,
      nextRunAt: nextRepetitionAt,
      cycleFireCount,
      activationCount: { increment: 1 },
      lastFiredAt: now,
      lastError: null,
      failureCount: 0,
    },
  });
  return "sent";
}

/** `organizationId` restringe a uma org (bateria de QA). O cron roda sem escopo. */
export async function fireDueLeadTriggers(scope: { organizationId?: string } = {}) {
  const now = new Date();
  const due = await prisma.leadTrigger.findMany({
    where: {
      isActive: true,
      nextRunAt: { not: null, lte: now },
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    },
    orderBy: { nextRunAt: "asc" },
    take: BATCH_LIMIT,
    select: { id: true },
  });

  const outcomes: Record<TriggerOutcome, number> = { sent: 0, rescheduled: 0, failed: 0, skipped: 0 };
  for (const trigger of due) {
    outcomes[await fireTrigger(trigger.id, now)] += 1;
  }
  return { due: due.length, ...outcomes };
}
