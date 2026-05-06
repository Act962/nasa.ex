/**
 * Seed de SavedInsightReport — Evolução de campanhas Meta
 *
 * Cria 6 relatórios salvos espaçados ao longo de ~90 dias, cada um com
 * `snapshot.metaAds.campaigns[]` populado. As campanhas evoluem entre os
 * snapshots (algumas melhoram, outras pioram, uma é descontinuada e outra
 * nasce no meio do caminho) pra o gráfico de evolução em
 * `/insights/relatorios → "Evolução de campanhas"` mostrar deltas
 * interessantes.
 *
 * Não depende de OAuth real nem do cron Inngest — popula direto.
 *
 * Rode com: npx tsx prisma/seed-saved-reports-demo.ts
 *
 * Idempotente — apaga relatórios criados pelo seed antes de recriar.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { randomUUID } from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const TARGET_EMAIL = "coringaforevernasa@gmail.com";

// Marcador no name pra identificar e apagar registros do seed
const SEED_TAG = "[demo-evolution]";

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0); // 10h da manhã, hora consistente
  return d;
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ── Definição das campanhas + trajetória de evolução ───────────────────────
//
// Cada campanha tem um array de KPIs base por snapshot (índice 0 = mais antigo).
// `null` = campanha não ativa naquele snapshot (não aparece no gráfico naquele ponto).

type CampaignTrajectory = {
  metaCampaignId: string;
  name: string;
  // Multiplicador de performance por snapshot (0 = ausente; 1.0 = baseline)
  multipliers: (number | null)[];
  baseline: {
    spend: number;
    impressions: number;
    convRate: number;
  };
};

const NUM_SNAPSHOTS = 6;

// 6 snapshots espaçados (90, 75, 60, 45, 30, 15 dias atrás)
const SNAPSHOT_DAYS_AGO = [90, 75, 60, 45, 30, 15];

const TRAJECTORIES: CampaignTrajectory[] = [
  {
    metaCampaignId: "demo-cmp-vendas-evergreen",
    name: "Vendas — Conversões (Evergreen)",
    // Cresce gradualmente: otimização contínua do criativo
    multipliers: [1.0, 1.15, 1.3, 1.45, 1.7, 2.0],
    baseline: { spend: 280, impressions: 38_000, convRate: 0.032 },
  },
  {
    metaCampaignId: "demo-cmp-leads-webinar",
    name: "Leads — Webinar Mensal",
    // Pico no meio (campanha sazonal): sobe forte e cai depois
    multipliers: [0.7, 1.0, 1.6, 1.8, 1.2, 0.9],
    baseline: { spend: 180, impressions: 24_000, convRate: 0.026 },
  },
  {
    metaCampaignId: "demo-cmp-awareness-marca",
    name: "Awareness — Topo de Funil",
    // Estagnação: investimento alto, mas conv rate piora (criativo cansou)
    multipliers: [1.2, 1.1, 1.0, 0.85, 0.7, 0.55],
    baseline: { spend: 250, impressions: 95_000, convRate: 0.008 },
  },
  {
    metaCampaignId: "demo-cmp-blackfriday-pulso",
    name: "Black Friday — Pulso (sazonal)",
    // Só ativa nos últimos 2 snapshots — campanha sazonal nasceu há 30d
    multipliers: [null, null, null, null, 2.5, 3.2],
    baseline: { spend: 350, impressions: 50_000, convRate: 0.045 },
  },
  {
    metaCampaignId: "demo-cmp-retargeting-legacy",
    name: "Retargeting — Legacy (descontinuada)",
    // Ativa nos primeiros snapshots, depois descontinuada
    multipliers: [1.4, 1.2, 1.0, 0.6, null, null],
    baseline: { spend: 120, impressions: 15_000, convRate: 0.022 },
  },
];

// ── Gerador de KPIs (a partir do baseline + multiplicador) ─────────────────

function generateCampaignKpis(
  baseline: CampaignTrajectory["baseline"],
  mult: number,
  hasVideo = false,
) {
  const m = mult * (0.92 + Math.random() * 0.16); // ±8% noise
  const spend = round2(baseline.spend * m);
  const impressions = Math.max(0, Math.round(baseline.impressions * m));
  const reach = Math.round(impressions * (0.55 + Math.random() * 0.2));
  const ctr = 0.012 + Math.random() * 0.018;
  const clicks = Math.round(impressions * ctr);
  const conversions = Math.round(clicks * baseline.convRate * (0.85 + Math.random() * 0.3));
  const leads = Math.round(conversions * (0.6 + Math.random() * 0.2));
  const conversionValue = round2(conversions * (60 + Math.random() * 80));
  const cpm = impressions > 0 ? round4((spend / impressions) * 1000) : 0;
  const cpc = clicks > 0 ? round4(spend / clicks) : 0;
  const cpa = conversions > 0 ? round4(spend / conversions) : 0;
  const cpl = leads > 0 ? round4(spend / leads) : 0;
  const roas = spend > 0 ? round4(conversionValue / spend) : 0;

  return {
    spend,
    impressions,
    reach,
    clicks,
    ctr: round4(ctr * 100), // em %
    leads,
    conversions,
    conversionValue,
    cpm,
    cpc,
    cpa,
    cpl,
    roas,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seed Saved Reports (Evolução Meta) — usuário: ${TARGET_EMAIL}\n`);

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: { members: { include: { organization: true } } },
  });
  if (!user) {
    console.error(`❌ Usuário "${TARGET_EMAIL}" não encontrado.`);
    process.exit(1);
  }
  const orgMember = user.members[0];
  if (!orgMember) {
    console.error("❌ Usuário não pertence a nenhuma organização.");
    process.exit(1);
  }
  const org = orgMember.organization;
  console.log(`✅ Org: ${org.name} (${org.id})\n`);

  // Limpa relatórios anteriores do seed
  console.log("🧹 Limpando relatórios anteriores do seed...");
  const deleted = await prisma.savedInsightReport.deleteMany({
    where: {
      organizationId: org.id,
      name: { contains: SEED_TAG },
    },
  });
  console.log(`   - ${deleted.count} relatórios removidos\n`);

  console.log(`📊 Criando ${NUM_SNAPSHOTS} relatórios salvos...`);

  for (let snapIdx = 0; snapIdx < NUM_SNAPSHOTS; snapIdx++) {
    const daysBack = SNAPSHOT_DAYS_AGO[snapIdx];
    const savedAt = daysAgo(daysBack);

    // Período coberto pelo relatório: 14 dias antes do savedAt até savedAt
    const periodEnd = savedAt;
    const periodStart = new Date(savedAt);
    periodStart.setDate(periodStart.getDate() - 14);

    // Monta lista de campanhas ativas neste snapshot
    const campaigns = TRAJECTORIES.map((t) => {
      const mult = t.multipliers[snapIdx];
      if (mult === null) return null;
      const k = generateCampaignKpis(t.baseline, mult);
      return {
        metaCampaignId: t.metaCampaignId,
        name: t.name,
        ...k,
      };
    }).filter((c) => c !== null);

    // Agrega total da conta a partir das campanhas
    const totalSpend = campaigns.reduce((s, c) => s + c!.spend, 0);
    const totalLeads = campaigns.reduce((s, c) => s + c!.leads, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c!.impressions, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c!.conversions, 0);
    const totalConvValue = campaigns.reduce((s, c) => s + c!.conversionValue, 0);

    const dateLabel = periodEnd.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });

    const reportName = `${SEED_TAG} Snapshot ${snapIdx + 1} de ${NUM_SNAPSHOTS} — ${dateLabel}`;

    await prisma.savedInsightReport.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        name: reportName,
        description: `Snapshot fictício (${SEED_TAG}) cobrindo 14 dias até ${dateLabel}.`,
        filters: {
          dateRange: {
            from: periodStart.toISOString(),
            to: periodEnd.toISOString(),
          },
          organizationIds: [],
          tagIds: [],
          trackingId: null,
        },
        modules: ["tracking", "integrations", "chat"],
        snapshot: {
          period: {
            startDate: periodStart.toISOString(),
            endDate: periodEnd.toISOString(),
          },
          tracking: {
            totalLeads: 100 + snapIdx * 25,
            wonLeads: 18 + snapIdx * 6,
            activeLeads: 70 + snapIdx * 15,
            conversionRate: round2(18 + snapIdx * 1.5),
          },
          metaAds: {
            spend: round2(totalSpend),
            leads: totalLeads,
            cpl: totalLeads > 0 ? round4(totalSpend / totalLeads) : 0,
            roas: totalSpend > 0 ? round4(totalConvValue / totalSpend) : 0,
            adAccountId: "act_demo_evolution",
            adAccountName: "Conta Demo (Evolução)",
            capturedAt: savedAt.toISOString(),
            campaigns,
          },
        },
        aiNarrative: null,
        shareToken: randomUUID().replace(/-/g, ""),
        // Sobrescreve createdAt pra simular o passado (savedAt real)
        createdAt: savedAt,
        updatedAt: savedAt,
      },
    });

    console.log(
      `   ${snapIdx + 1}/${NUM_SNAPSHOTS} · ${dateLabel} · ${campaigns.length} campanhas · R$ ${totalSpend.toFixed(2)} investido`,
    );
  }

  console.log("\n✨ Pronto!");
  console.log("\n🌌 Acesse `/insights/relatorios` → seção 'Evolução de campanhas'.");
  console.log("   - 6 snapshots ao longo de 90 dias");
  console.log("   - 5 campanhas com trajetórias diferentes:");
  console.log("     · Vendas Evergreen — cresce 2x (verde)");
  console.log("     · Webinar Mensal — pico no meio (cresce e cai)");
  console.log("     · Awareness — declina 50% (vermelho)");
  console.log("     · Black Friday — nasce nos últimos 30d");
  console.log("     · Retargeting Legacy — descontinuada nos últimos 30d\n");
}

main()
  .catch((e) => { console.error("❌ Falha no seed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
