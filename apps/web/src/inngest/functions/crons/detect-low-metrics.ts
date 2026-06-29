/**
 * Cron: detect-low-metrics
 *
 * Roda 2× por dia (9h e 15h) — varre regras `metric.below_threshold`
 * ativas e compara métricas atuais vs threshold configurado.
 *
 * Métricas suportadas (params.metric):
 *   - conversion_rate:    Lead.wonLeads / totalLeads (window_days)
 *   - ttfr_seconds:       avg time_to_first_response calculated via raw SQL
 *   - stars_balance:      Organization.starsBalance (snapshot atual)
 *   - no_show_rate:       Appointment NO_SHOW / total no window
 *
 * Idempotência: entityKey="metric:<orgId>:<metric>:<YYYY-MM-DD>" —
 * uma org só dispara 1× por dia por métrica, mesmo se o cron rodar 2×.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";

type MetricKey =
  | "conversion_rate"
  | "ttfr_seconds"
  | "stars_balance"
  | "no_show_rate";

interface LowMetricParams {
  metric: MetricKey;
  threshold: number;
  windowDays?: number;
}

export const detectLowMetrics = inngest.createFunction(
  { id: "detect-low-metrics", retries: 1 },
  { cron: "0 9,15 * * *" },
  async ({ step }) => {
    const rules = await step.run("fetch-rules", async () =>
      prisma.alertRule.findMany({
        where: { eventType: "metric.below_threshold", isActive: true },
        select: { id: true, organizationId: true, params: true },
      }),
    );

    if (rules.length === 0) {
      return { rulesScanned: 0, dispatched: 0 };
    }

    let totalDispatched = 0;

    for (const rule of rules) {
      const params = rule.params as unknown as LowMetricParams | null;
      if (!params?.metric || typeof params.threshold !== "number") continue;
      // Regras globais (organizationId=null) NÃO disparam aqui — não dá
      // pra computar métrica "global" significativa sem agregação cross-org.
      // Apenas regras escopadas a uma org.
      if (!rule.organizationId) continue;

      const orgId = rule.organizationId;
      const windowDays = params.windowDays ?? 7;
      const value = await step.run(
        `compute-${rule.id}`,
        async () => computeMetric(params.metric, orgId, windowDays),
      );

      if (value === null) continue; // sem dados pra avaliar

      if (value < params.threshold) {
        const result = await dispatchAlert("metric.below_threshold", {
          orgId,
          metric: params.metric,
          currentValue: value,
          threshold: params.threshold,
        });
        totalDispatched += result.dispatchedCount;
      }
    }

    return { rulesScanned: rules.length, dispatched: totalDispatched };
  },
);

async function computeMetric(
  metric: MetricKey,
  organizationId: string,
  windowDays: number,
): Promise<number | null> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  switch (metric) {
    case "conversion_rate": {
      const where: Prisma.LeadWhereInput = {
        tracking: { organizationId },
        createdAt: { gte: since },
      };
      const [total, won] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({
          where: { ...where, currentAction: "WON" },
        }),
      ]);
      if (total === 0) return null;
      return (won / total) * 100; // percentual
    }

    case "ttfr_seconds": {
      // Raw SQL: tempo entre 1ª mensagem inbound e 1ª outbound em cada conversa.
      // Aproximação: usa lastInboundAt + lastOutboundAt do Lead.
      // (TTFR exato precisaria varrer Message — fica como upgrade.)
      const rows = await prisma.$queryRaw<
        { avg_seconds: number | null }[]
      >`
        SELECT AVG(EXTRACT(EPOCH FROM (l.last_outbound_at - l.last_inbound_at)))::float AS avg_seconds
        FROM "lead" l
        INNER JOIN "tracking" t ON t.id = l.tracking_id
        WHERE t.organization_id = ${organizationId}
          AND l.last_inbound_at IS NOT NULL
          AND l.last_outbound_at IS NOT NULL
          AND l.last_outbound_at > l.last_inbound_at
          AND l.created_at >= ${since}
      `;
      return rows[0]?.avg_seconds ?? null;
    }

    case "stars_balance": {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { starsBalance: true },
      });
      return org?.starsBalance ?? null;
    }

    case "no_show_rate": {
      const where: Prisma.AppointmentWhereInput = {
        agenda: { organizationId },
        startsAt: { gte: since },
      };
      const [total, noShow] = await Promise.all([
        prisma.appointment.count({ where }),
        prisma.appointment.count({
          where: { ...where, status: "NO_SHOW" },
        }),
      ]);
      if (total === 0) return null;
      // Inverted: "no_show_rate < threshold" só dispara quando rate é alto
      // = poucos shows. Trocamos sinal pra ser consistente com outras
      // métricas (alerta quando valor "ruim" estiver "abaixo do limiar").
      // Aqui retornamos (100 - noShowPct) — "taxa de comparecimento":
      //   regra threshold=70 → "alerte se taxa de comparecimento cair abaixo de 70%"
      return ((total - noShow) / total) * 100;
    }
  }
}
