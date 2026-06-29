/**
 * Seed de Relatórios Meta Ads — Comparação (60 dias com tendência)
 *
 * Popula 60 dias com tendência clara: os primeiros 30 dias (mais antigos) têm
 * KPIs baixos; os últimos 30 dias (recentes) têm KPIs ~3x maiores. Assim,
 * quando você abre o relatório com o filtro padrão (últimos 30d), o "período
 * anterior" cai exatamente nos 30 dias antigos e os deltas dos KPI cards
 * aparecem coloridos (verde grande pra crescimentos, vermelho pra custos
 * reduzidos).
 *
 * Estrutura criada (prefixo `seed-meta-cmp-` pra coexistir com outros seeds):
 *  - 1 ad account fake
 *  - 3 campanhas
 *  - 6 adsets (2 por campanha)
 *  - 12 ads (2 por adset)
 *  - Snapshots × 60 dias × 4 níveis ≈ 22 entidades × 60 dias = 1.320 snapshots
 *
 * Rode com: npx tsx prisma/seed-meta-ads-comparison.ts
 *
 * Idempotente — apaga registros do seed antes de recriar.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const TARGET_EMAIL = "coringaforevernasa@gmail.com";
const SEED_PREFIX = "seed-meta-cmp-";
const AD_ACCOUNT_ID = `act_${SEED_PREFIX}demo`;
const DAYS_BACK = 60;
const PIVOT_DAY = 30; // primeiros 30 dias (mais antigos) são "baseline baixo"

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return startOfDay(d);
}
function dayMultiplier(date: Date): number {
  const dow = date.getDay();
  const weekend = dow === 0 || dow === 6 ? 1.25 : 1.0;
  const noise = 0.85 + Math.random() * 0.3;
  return weekend * noise;
}

/** Multiplicador adicional baseado no dia (ramp-up nos últimos 30d). */
function trendMultiplier(daysFromToday: number): number {
  // daysFromToday: 1..60 (1 = ontem, 60 = mais antigo)
  // Período recente (1..30): ~2.5–3.5x
  // Período antigo (31..60): ~0.7–1.1x
  if (daysFromToday <= PIVOT_DAY) {
    // Quanto mais recente, maior — ramp suave de 2.2 a 3.5
    const t = (PIVOT_DAY - daysFromToday) / PIVOT_DAY; // 0..1 (ontem=1)
    return 2.2 + t * 1.3;
  } else {
    // Período antigo: baseline baixo, leve declínio mais pra trás
    const t = (daysFromToday - PIVOT_DAY) / PIVOT_DAY; // 0..1
    return 1.1 - t * 0.4;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ── Definições ─────────────────────────────────────────────────────────────

type SeedCampaign = {
  metaCampaignId: string;
  name: string;
  objective: string;
  baseImpressions: number;
  baseSpend: number;
  baseConvRate: number;
  hasVideo: boolean;
};

const CAMPAIGNS: SeedCampaign[] = [
  {
    metaCampaignId: `${SEED_PREFIX}cmp-vendas-otimizada`,
    name: "Vendas Otimizada — Ramp-up",
    objective: "OUTCOME_SALES",
    baseImpressions: 30_000,
    baseSpend: 200,
    baseConvRate: 0.035,
    hasVideo: false,
  },
  {
    metaCampaignId: `${SEED_PREFIX}cmp-leads-otimizada`,
    name: "Leads Otimizada — Ramp-up",
    objective: "OUTCOME_LEADS",
    baseImpressions: 18_000,
    baseSpend: 120,
    baseConvRate: 0.025,
    hasVideo: true,
  },
  {
    metaCampaignId: `${SEED_PREFIX}cmp-awareness-piloto`,
    name: "Awareness Piloto — Ramp-up",
    objective: "OUTCOME_AWARENESS",
    baseImpressions: 60_000,
    baseSpend: 140,
    baseConvRate: 0.007,
    hasVideo: true,
  },
];

const ADSETS_BY_CMP: Record<string, { name: string; goal: string; weight: number }[]> = {
  [`${SEED_PREFIX}cmp-vendas-otimizada`]: [
    { name: "Lookalike Compradores 1%", goal: "OFFSITE_CONVERSIONS", weight: 0.6 },
    { name: "Retargeting Carrinho", goal: "OFFSITE_CONVERSIONS", weight: 0.4 },
  ],
  [`${SEED_PREFIX}cmp-leads-otimizada`]: [
    { name: "Interesse Topo de Funil", goal: "LEAD_GENERATION", weight: 0.55 },
    { name: "Lookalike Leads 30d", goal: "LEAD_GENERATION", weight: 0.45 },
  ],
  [`${SEED_PREFIX}cmp-awareness-piloto`]: [
    { name: "Broad 18-44 BR", goal: "REACH", weight: 0.7 },
    { name: "Engajadores 90d", goal: "REACH", weight: 0.3 },
  ],
};

const ADS_PER_ADSET = 2;

// ── KPI generator ──────────────────────────────────────────────────────────

function generateKpis(opts: {
  baseImpressions: number;
  baseSpend: number;
  baseConvRate: number;
  hasVideo: boolean;
  weight: number;
  multiplier: number;
  /** Conv rate cresce no período recente (otimização do criativo) */
  convRateBoost?: number;
}) {
  const m = opts.weight * opts.multiplier;
  const impressions = Math.max(0, Math.round(opts.baseImpressions * m));
  const reach = Math.round(impressions * (0.55 + Math.random() * 0.2));
  const frequency = reach > 0 ? round4(impressions / reach) : 0;
  const ctr = 0.012 + Math.random() * 0.018;
  const clicks = Math.round(impressions * ctr);
  const engagement = Math.round(clicks * (1.4 + Math.random() * 0.6));
  const spend = round2(opts.baseSpend * m);
  const cpm = impressions > 0 ? round4((spend / impressions) * 1000) : 0;
  const cpc = clicks > 0 ? round4(spend / clicks) : 0;
  const cpp = reach > 0 ? round4((spend / reach) * 1000) : 0;
  const effectiveConvRate = opts.baseConvRate * (opts.convRateBoost ?? 1);
  const conversions = Math.round(clicks * effectiveConvRate * (0.85 + Math.random() * 0.3));
  const leads = Math.round(conversions * (0.6 + Math.random() * 0.2));
  const cpa = conversions > 0 ? round4(spend / conversions) : 0;
  const cpl = leads > 0 ? round4(spend / leads) : 0;
  const conversionValue = round2(conversions * (45 + Math.random() * 90));
  const conversionRate = clicks > 0 ? round4(conversions / clicks) : 0;
  const roas = spend > 0 ? round4(conversionValue / spend) : 0;
  const roi = spend > 0 ? round4((conversionValue - spend) / spend) : 0;
  const videoPlays = opts.hasVideo ? Math.round(impressions * (0.45 + Math.random() * 0.15)) : 0;
  const videoP25 = Math.round(videoPlays * 0.78);
  const videoP50 = Math.round(videoPlays * 0.55);
  const videoP75 = Math.round(videoPlays * 0.38);
  const videoP100 = Math.round(videoPlays * 0.22);
  const videoAvgWatchTime = opts.hasVideo ? round2(8 + Math.random() * 14) : 0;
  const cpv = videoPlays > 0 ? round4(spend / videoPlays) : 0;

  return {
    reach, impressions, frequency, clicks, ctr: round4(ctr), engagement,
    spend, cpm, cpc, cpp, cpl, cpa, cpv,
    conversions, leads, conversionValue, conversionRate, roas, roi,
    videoPlays, videoP25, videoP50, videoP75, videoP100, videoAvgWatchTime,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seed Meta Ads Comparação (60d, tendência) — usuário: ${TARGET_EMAIL}\n`);

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

  console.log("🧹 Limpando seed comparison anterior...");
  const deletedSnaps = await prisma.metaAdsKpiSnapshot.deleteMany({
    where: {
      organizationId: org.id,
      OR: [{ entityId: { startsWith: SEED_PREFIX } }, { entityId: AD_ACCOUNT_ID }],
    },
  });
  const deletedCmps = await prisma.metaAdCampaign.deleteMany({
    where: { organizationId: org.id, metaCampaignId: { startsWith: SEED_PREFIX } },
  });
  console.log(`   - ${deletedSnaps.count} snapshots / ${deletedCmps.count} campanhas removidas\n`);

  console.log("📦 Criando estrutura...");
  const createdCampaigns: { id: string; data: SeedCampaign }[] = [];
  const createdAdsets: { id: string; meta: string; data: SeedCampaign; weight: number; goal: string; name: string }[] = [];
  const createdAds: { id: string; meta: string; data: SeedCampaign; weight: number; name: string }[] = [];

  const now = new Date();
  const startTime = daysAgo(DAYS_BACK + 5);

  for (const cmp of CAMPAIGNS) {
    const created = await prisma.metaAdCampaign.create({
      data: {
        organizationId: org.id, metaCampaignId: cmp.metaCampaignId,
        adAccountId: AD_ACCOUNT_ID, name: cmp.name, objective: cmp.objective,
        status: "ACTIVE", effectiveStatus: "ACTIVE", dailyBudget: cmp.baseSpend,
        startTime, lastSyncedAt: now,
      },
    });
    createdCampaigns.push({ id: created.id, data: cmp });

    const adsetDefs = ADSETS_BY_CMP[cmp.metaCampaignId];
    for (let i = 0; i < adsetDefs.length; i++) {
      const def = adsetDefs[i];
      const metaAdsetId = `${SEED_PREFIX}as-${cmp.metaCampaignId.split("-").pop()}-${i + 1}`;
      const adset = await prisma.metaAdSet.create({
        data: {
          organizationId: org.id, campaignId: created.id, metaAdsetId,
          name: def.name, status: "ACTIVE", effectiveStatus: "ACTIVE",
          optimizationGoal: def.goal, billingEvent: "IMPRESSIONS",
          dailyBudget: round2(cmp.baseSpend * def.weight),
          startTime, lastSyncedAt: now,
        },
      });
      createdAdsets.push({ id: adset.id, meta: metaAdsetId, data: cmp, weight: def.weight, goal: def.goal, name: def.name });

      for (let a = 1; a <= ADS_PER_ADSET; a++) {
        const metaAdId = `${SEED_PREFIX}ad-${metaAdsetId.replace(SEED_PREFIX, "")}-${a}`;
        const ad = await prisma.metaAd.create({
          data: {
            organizationId: org.id, campaignId: created.id, adsetId: adset.id,
            metaAdId, name: `${def.name} — Criativo ${a}`,
            status: "ACTIVE", effectiveStatus: "ACTIVE",
            creativeId: `${SEED_PREFIX}cr-${a}`, lastSyncedAt: now,
          },
        });
        createdAds.push({ id: ad.id, meta: metaAdId, data: cmp, weight: def.weight / ADS_PER_ADSET, name: ad.name });
      }
    }
  }
  console.log(`   - ${createdCampaigns.length} campaigns / ${createdAdsets.length} adsets / ${createdAds.length} ads\n`);

  console.log(`📊 Gerando snapshots × ${DAYS_BACK} dias (com tendência ramp-up)...`);
  const snapshotsToCreate: any[] = [];

  for (let dayOffset = DAYS_BACK; dayOffset >= 1; dayOffset--) {
    const date = daysAgo(dayOffset);
    const dailyMult = dayMultiplier(date);
    const trend = trendMultiplier(dayOffset);
    const mult = dailyMult * trend;
    // Conv rate boost no período recente: criativo ficou melhor
    const convRateBoost = dayOffset <= PIVOT_DAY ? 1.4 : 1.0;

    let acc = generateKpis({
      baseImpressions: 0, baseSpend: 0, baseConvRate: 0, hasVideo: false,
      weight: 0, multiplier: 0,
    });

    for (const { data: cmp } of createdCampaigns) {
      const k = generateKpis({ ...cmp, weight: 1, multiplier: mult, convRateBoost });
      snapshotsToCreate.push({
        organizationId: org.id, level: "CAMPAIGN" as const,
        entityId: cmp.metaCampaignId, entityName: cmp.name, date, ...k,
      });
      for (const key of Object.keys(k) as (keyof typeof k)[]) {
        (acc as any)[key] = ((acc as any)[key] ?? 0) + k[key];
      }
    }

    acc.reach = Math.round(acc.reach * 0.78);
    acc.frequency = acc.reach > 0 ? round4(acc.impressions / acc.reach) : 0;
    acc.ctr = acc.impressions > 0 ? round4(acc.clicks / acc.impressions) : 0;
    acc.cpm = acc.impressions > 0 ? round4((acc.spend / acc.impressions) * 1000) : 0;
    acc.cpc = acc.clicks > 0 ? round4(acc.spend / acc.clicks) : 0;
    acc.spend = round2(acc.spend);
    acc.conversionValue = round2(acc.conversionValue);

    snapshotsToCreate.push({
      organizationId: org.id, level: "ACCOUNT" as const,
      entityId: AD_ACCOUNT_ID, entityName: `Conta Comparação (${org.name})`, date, ...acc,
    });

    for (const adset of createdAdsets) {
      snapshotsToCreate.push({
        organizationId: org.id, level: "ADSET" as const,
        entityId: adset.meta, entityName: adset.name, date,
        ...generateKpis({ ...adset.data, weight: adset.weight, multiplier: mult, convRateBoost }),
      });
    }

    for (const ad of createdAds) {
      snapshotsToCreate.push({
        organizationId: org.id, level: "AD" as const,
        entityId: ad.meta, entityName: ad.name, date,
        ...generateKpis({ ...ad.data, weight: ad.weight, multiplier: mult, convRateBoost }),
      });
    }
  }

  const result = await prisma.metaAdsKpiSnapshot.createMany({
    data: snapshotsToCreate, skipDuplicates: true,
  });
  console.log(`   - ${result.count} snapshots inseridos\n`);

  // Resumo separando os dois períodos
  const snapsByPeriod = snapshotsToCreate
    .filter((s) => s.level === "ACCOUNT")
    .reduce(
      (acc, s) => {
        const dayOffset = Math.round(
          (Date.now() - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24),
        );
        const bucket = dayOffset <= PIVOT_DAY ? "recent" : "old";
        acc[bucket].spend += Number(s.spend ?? 0);
        acc[bucket].impressions += s.impressions ?? 0;
        acc[bucket].conversions += s.conversions ?? 0;
        return acc;
      },
      {
        recent: { spend: 0, impressions: 0, conversions: 0 },
        old: { spend: 0, impressions: 0, conversions: 0 },
      },
    );

  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  console.log("✨ Comparação esperada no relatório (filtro padrão: últimos 30d):");
  console.log("   Período RECENTE (últimos 30d):");
  console.log(`      Investido:   R$ ${fmt(snapsByPeriod.recent.spend)}`);
  console.log(`      Impressões:  ${snapsByPeriod.recent.impressions.toLocaleString("pt-BR")}`);
  console.log(`      Conversões:  ${snapsByPeriod.recent.conversions.toLocaleString("pt-BR")}`);
  console.log("   Período ANTERIOR (30 dias antes):");
  console.log(`      Investido:   R$ ${fmt(snapsByPeriod.old.spend)}`);
  console.log(`      Impressões:  ${snapsByPeriod.old.impressions.toLocaleString("pt-BR")}`);
  console.log(`      Conversões:  ${snapsByPeriod.old.conversions.toLocaleString("pt-BR")}`);
  console.log(
    `\n   → Os deltas dos KPI cards vão aparecer com ~${
      snapsByPeriod.old.spend > 0
        ? Math.round((snapsByPeriod.recent.spend / snapsByPeriod.old.spend - 1) * 100)
        : 0
    }% de crescimento em verde.\n`,
  );
}

main()
  .catch((e) => { console.error("❌ Falha no seed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
