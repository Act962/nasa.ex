import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { computeLeadMetrics } from "@/features/leads/lib/metrics/compute-lead-metrics";
import { refreshLeadMetrics } from "@/features/leads/lib/metrics/save-lead-metrics";
import { AUTO_METRICS_SINCE, LEAD_METRICS_RECOMPUTE_EVENT } from "@/features/leads/lib/metrics/constants";

// Recalcula as métricas do lead depois de cada interação (spec 0035, D-4).
// O debounce junta a rajada de mensagens num cálculo só.

const DAY_MS = 24 * 60 * 60_000;
const ACTIVE_WINDOW_DAYS = 60;
const NIGHTLY_BATCH_LIMIT = 2000;
const NIGHTLY_CHUNK_SIZE = 250;

async function shouldTrackAutomatically(leadId: string): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { createdAt: true, metrics: { select: { id: true } } },
  });
  // Lead antigo sem métricas espera o "Auditar Lead" — sem backfill em massa (D-5).
  return Boolean(lead && (lead.metrics || lead.createdAt >= AUTO_METRICS_SINCE));
}

async function hasInteractedSince(leadId: string, since: Date): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { lastInboundAt: true, lastOutboundAt: true },
  });
  return Boolean(
    lead && ((lead.lastInboundAt && lead.lastInboundAt >= since) || (lead.lastOutboundAt && lead.lastOutboundAt >= since)),
  );
}

async function recomputeOneLead(leadId: string): Promise<{ skipped: boolean }> {
  if (!(await shouldTrackAutomatically(leadId))) return { skipped: true };
  const computed = await computeLeadMetrics(leadId);
  if (computed) await refreshLeadMetrics(leadId, computed);
  return { skipped: false };
}

// A madrugada não passa pela fila por lead da função acima. Se o lead conversou
// durante o cálculo, o recálculo da mensagem é o mais novo: não sobrescrevemos.
async function recomputeOneLeadNightly(leadId: string): Promise<{ skipped: boolean }> {
  if (!(await shouldTrackAutomatically(leadId))) return { skipped: true };
  const startedAt = new Date();
  const computed = await computeLeadMetrics(leadId);
  if (!computed || (await hasInteractedSince(leadId, startedAt))) return { skipped: true };
  await refreshLeadMetrics(leadId, computed);
  return { skipped: false };
}

export const recomputeLeadMetrics = inngest.createFunction(
  {
    id: "lead-metrics-recompute",
    retries: 1,
    debounce: { period: "2m", key: "event.data.leadId" },
    concurrency: { limit: 1, key: "event.data.leadId" },
  },
  { event: LEAD_METRICS_RECOMPUTE_EVENT },
  // Sem steps: roda a cada rajada de mensagens, e cada step custaria uma execução a mais.
  async ({ event }) => {
    const { leadId } = event.data as { leadId: string };
    return recomputeOneLead(leadId);
  },
);

/** "Interações/mês" envelhece sem mensagem nova: o cron da madrugada atualiza. */
export const recomputeActiveLeadMetricsNightly = inngest.createFunction(
  { id: "lead-metrics-recompute-nightly", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 4 * * *" },
  async ({ step }) => {
    const leadIds = await step.run("active-leads", async () => {
      const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY_MS);
      const rows = await prisma.leadMetrics.findMany({
        where: { lead: { OR: [{ lastInboundAt: { gte: since } }, { lastOutboundAt: { gte: since } }] } },
        select: { leadId: true },
        take: NIGHTLY_BATCH_LIMIT,
      });
      return rows.map((row) => row.leadId);
    });
    // Lotes dentro desta função em vez de um evento por lead: o fan-out custava
    // 3 execuções por lead (até 6 mil por noite).
    let recomputed = 0;
    const failedLeadIds: string[] = [];
    for (let offset = 0; offset < leadIds.length; offset += NIGHTLY_CHUNK_SIZE) {
      const chunk = leadIds.slice(offset, offset + NIGHTLY_CHUNK_SIZE);
      const chunkOutcome = await step.run(`recompute-${offset}`, async () => {
        let chunkRecomputed = 0;
        const chunkFailedLeadIds: string[] = [];
        for (const leadId of chunk) {
          try {
            const outcome = await recomputeOneLeadNightly(leadId);
            if (!outcome.skipped) chunkRecomputed++;
          } catch (error) {
            console.error("[lead-metrics-nightly] falha no lead", leadId, error);
            chunkFailedLeadIds.push(leadId);
          }
        }
        return { recomputed: chunkRecomputed, failedLeadIds: chunkFailedLeadIds };
      });
      recomputed += chunkOutcome.recomputed;
      failedLeadIds.push(...chunkOutcome.failedLeadIds);
    }

    // Só quem falhou volta pela função por lead, que tem retry e fila por lead.
    if (failedLeadIds.length > 0) {
      await step.sendEvent(
        "retry-failed",
        failedLeadIds.map((leadId) => ({ name: LEAD_METRICS_RECOMPUTE_EVENT, data: { leadId } })),
      );
    }
    return { scanned: leadIds.length, recomputed, retried: failedLeadIds.length };
  },
);
