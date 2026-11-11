import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { computeLeadMetrics } from "@/features/leads/lib/metrics/compute-lead-metrics";
import { refreshLeadMetrics } from "@/features/leads/lib/metrics/save-lead-metrics";
import { AUTO_METRICS_SINCE, LEAD_METRICS_RECOMPUTE_EVENT } from "@/features/leads/lib/metrics/constants";

// Recalcula as métricas do lead (spec 0035, RF-4): nos eventos que mudam o lead de verdade
// (proposta paga, atendimento finalizado, agenda, PIX) e, para as mensagens, no cron da madrugada.
// Mensagem não dispara mais recálculo: era uma execução por rajada de conversa.

const DAY_MS = 24 * 60 * 60_000;
const ACTIVE_WINDOW_DAYS = 60;
// Teto de segurança (tamanho da resposta da etapa), não de custo: cada lote de 250 é uma execução.
const NIGHTLY_SAFETY_LIMIT = 50_000;
const NIGHTLY_CHUNK_SIZE = 250;

async function shouldTrackAutomatically(leadId: string): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { createdAt: true, metrics: { select: { id: true } } },
  });
  // Lead antigo sem métricas espera o "Auditar Lead" — sem backfill em massa (D-5).
  return Boolean(lead && (lead.metrics || lead.createdAt >= AUTO_METRICS_SINCE));
}

async function recomputeOneLead(leadId: string): Promise<{ skipped: boolean }> {
  if (!(await shouldTrackAutomatically(leadId))) return { skipped: true };
  const computed = await computeLeadMetrics(leadId);
  if (computed) await refreshLeadMetrics(leadId, computed);
  return { skipped: false };
}

// A madrugada é o único recálculo depois de mensagem: se o lead conversou durante o
// cálculo, calcula de novo na hora em vez de pular (pular deixava a métrica um dia atrasada).
async function recomputeOneLeadNightly(leadId: string): Promise<{ skipped: boolean }> {
  if (!(await shouldTrackAutomatically(leadId))) return { skipped: true };
  const startedAt = new Date();
  const computed = await computeLeadMetrics(leadId);
  if (!computed) return { skipped: true };
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { lastInboundAt: true, lastOutboundAt: true },
  });
  const hasInteractedDuringRun = Boolean(
    lead && ((lead.lastInboundAt && lead.lastInboundAt >= startedAt) || (lead.lastOutboundAt && lead.lastOutboundAt >= startedAt)),
  );
  const freshest = hasInteractedDuringRun ? ((await computeLeadMetrics(leadId)) ?? computed) : computed;
  await refreshLeadMetrics(leadId, freshest);
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

/** Mensagens do dia e "Interações/mês", que envelhece sem mensagem nova: o cron da madrugada atualiza. */
export const recomputeActiveLeadMetricsNightly = inngest.createFunction(
  { id: "lead-metrics-recompute-nightly", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 4 * * *" },
  async ({ step }) => {
    const leadIds = await step.run("active-leads", async () => {
      const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * DAY_MS);
      // Inclui lead novo ainda sem métricas: a primeira linha nasce aqui, já que mensagem não recalcula mais.
      const rows = await prisma.lead.findMany({
        where: {
          OR: [{ lastInboundAt: { gte: since } }, { lastOutboundAt: { gte: since } }],
          AND: [{ OR: [{ metrics: { isNot: null } }, { createdAt: { gte: AUTO_METRICS_SINCE } }] }],
        },
        select: { id: true },
        take: NIGHTLY_SAFETY_LIMIT,
      });
      if (rows.length === NIGHTLY_SAFETY_LIMIT) {
        console.warn("[lead-metrics-nightly] teto de segurança atingido; leads além dele não entram nesta noite (subir o teto ou paginar)");
      }
      return rows.map((row) => row.id);
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
