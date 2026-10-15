// Crons de varredura agrupados em três funções (5 min, 15 min, 1 h), sem steps.
// O Inngest cobra execuções = runs × (steps + 1); com um cron por varredura, a
// maioria rodando sem achar nada, eram ~11 mil execuções/dia com 5 usuários.
// Agrupados, cada tick custa 1 execução. Cada varredura é idempotente: se uma
// falhar, as outras seguem e o próximo tick tenta de novo.

import { inngest } from "@/inngest/client";
import { createInlineStep, type InlineStep } from "@/inngest/inline-step";
import { runAstroCommanderTick } from "@/inngest/functions/astro-commander/commander-tick";
import { runPlannerPublishSweep } from "@/inngest/functions/nasa-planner/publish-sweep-cron";
import { runSyncPostMetrics } from "@/inngest/functions/nasa-planner/sync-post-metrics-cron";
import { runDispatchDueBroadcasts } from "@/inngest/functions/campanhas/dispatch-due-broadcasts";
import { runEmailLeadCapture } from "./email-lead-capture";
import { runDetectAgendaStarting } from "./detect-agenda-starting";
import { runWorldEventOccupancyTick } from "./world-event-occupancy-tick";
import { runDetectActionsDueSoon } from "./detect-actions-due-soon";
import { runDetectBrokenIntegrations } from "./detect-broken-integrations";
import { runDetectFormAbandoned } from "./detect-form-abandoned";
import { runDetectOverdue } from "./detect-overdue";
import { runDetectStaleLeads } from "./detect-stale-leads";
import { runNasaRouteArchivePastEvents } from "./nasa-route-archive-past-events";
import { runStarsPendingSweep } from "./stars-pending-sweep";
import { runTrafegoKanbanDriftSweep } from "./trafego-kanban-drift-sweep";
import { runTrafegoPixPendingSweep } from "./trafego-pix-pending-sweep";
import { runLeadWaitingDetection } from "@/features/alerts/lib/detectors/lead-waiting";
import { fireDueLeadTriggers } from "@/features/leads/lib/triggers/fire-due-triggers";
import { runScheduledWorkflows } from "@/features/workflows/lib/schedule/run-scheduled-workflows";
import { sendDueRecordNotices } from "@/features/form-records/server/record-notices";
import { runAiTokenUsageDetection } from "@/features/alerts/lib/ai-token-alerts";
import { runAiCreditBalanceCheck } from "@/features/ai-credits/lib/run-credit-balance-check";

type PollingJob = (step: InlineStep) => Promise<unknown>;

const FIVE_MINUTE_JOBS: Record<string, PollingJob> = {
  "astro-commander": runAstroCommanderTick,
  "lead-waiting": (step) => runLeadWaitingDetection(step),
  "lead-triggers": () => fireDueLeadTriggers(),
  "scheduled-workflows": () => runScheduledWorkflows(),
  "planner-publish-sweep": runPlannerPublishSweep,
  "email-lead-capture": runEmailLeadCapture,
};

const FIFTEEN_MINUTE_JOBS: Record<string, PollingJob> = {
  "campanhas-due-broadcasts": runDispatchDueBroadcasts,
  "agenda-starting": runDetectAgendaStarting,
  "world-event-occupancy": runWorldEventOccupancyTick,
  "record-notices": () => sendDueRecordNotices(),
};

const HOURLY_JOBS: Record<string, PollingJob> = {
  "actions-due-soon": runDetectActionsDueSoon,
  "broken-integrations": runDetectBrokenIntegrations,
  "form-abandoned": runDetectFormAbandoned,
  "overdue-demands": () => runDetectOverdue(),
  "stale-leads": runDetectStaleLeads,
  "nasa-route-archive-past-events": runNasaRouteArchivePastEvents,
  "stars-pending-sweep": runStarsPendingSweep,
  "planner-post-metrics": runSyncPostMetrics,
  "trafego-kanban-drift": runTrafegoKanbanDriftSweep,
  "trafego-pix-pending": runTrafegoPixPendingSweep,
  "ai-token-usage": () => runAiTokenUsageDetection(),
  "ai-credit-balance": () => runAiCreditBalanceCheck(),
};

async function runPollingJobs(tickerId: string, jobs: Record<string, PollingJob>) {
  const step = createInlineStep();
  const entries = Object.entries(jobs);
  const settled = await Promise.allSettled(entries.map(([, job]) => job(step)));

  const results: Record<string, unknown> = {};
  settled.forEach((outcome, index) => {
    const [jobName] = entries[index]!;
    if (outcome.status === "fulfilled") {
      results[jobName] = outcome.value ?? "ok";
      return;
    }
    const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
    console.error(`[${tickerId}] ${jobName} falhou`, outcome.reason);
    results[jobName] = { error: message };
  });
  return results;
}

// `singleton: skip` — se um tick ainda estiver rodando, o seguinte é descartado
// em vez de enfileirar.
export const pollingTicker5m = inngest.createFunction(
  { id: "polling-ticker-5m", retries: 0, singleton: { mode: "skip" } },
  { cron: "*/5 * * * *" },
  async () => runPollingJobs("polling-ticker-5m", FIVE_MINUTE_JOBS),
);

export const pollingTicker15m = inngest.createFunction(
  { id: "polling-ticker-15m", retries: 0, singleton: { mode: "skip" } },
  { cron: "*/15 * * * *" },
  async () => runPollingJobs("polling-ticker-15m", FIFTEEN_MINUTE_JOBS),
);

export const pollingTickerHourly = inngest.createFunction(
  { id: "polling-ticker-hourly", retries: 0, singleton: { mode: "skip" } },
  { cron: "0 * * * *" },
  async () => runPollingJobs("polling-ticker-hourly", HOURLY_JOBS),
);
