/**
 * Seed de Relatórios Meta Ads — Demo
 *
 * Popula MetaAdCampaign + MetaAdSet + MetaAd + MetaAdsKpiSnapshot com dados
 * realistas dos últimos 30 dias para validar a UI de relatórios da Meta
 * (`/insights` → painel Meta Insights) sem precisar de OAuth real / cron Inngest.
 *
 * Estrutura criada (todos prefixados `seed-meta-` para idempotência):
 *  - 1 ad account fake
 *  - 3 campanhas
 *  - 6 adsets (2 por campanha)
 *  - 12 ads (2 por adset)
 *  - Snapshots diários × 30 dias × 4 níveis (ACCOUNT/CAMPAIGN/ADSET/AD)
 *    ≈ 1 + 3 + 6 + 12 = 22 entidades × 30 dias = 660 snapshots
 *
 * Rode com: npx tsx prisma/seed-meta-ads-demo.ts
 *
 * Idempotente — apaga registros do seed antes de recriar.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const TARGET_EMAIL = "coringaforevernasa@gmail.com";

// Marcador comum em entityIds/metaIds para localizar e apagar registros do seed.
const SEED_PREFIX = "seed-meta-";
const AD_ACCOUNT_ID = `act_${SEED_PREFIX}demo`;
const DAYS_BACK = 30;

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

/** Variação diária com leve tendência sazonal (alta no fim de semana). */
function dayMultiplier(date: Date): number {
  const dow = date.getDay(); // 0=dom, 6=sáb
  const weekend = dow === 0 || dow === 6 ? 1.25 : 1.0;
  const noise = 0.85 + Math.random() * 0.3; // ±15%
  return weekend * noise;
}

/** Arredonda para 2 casas (Decimal). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Arredonda para 4 casas (Decimal de taxa). */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Definições estáticas das entidades fake ────────────────────────────────

type SeedCampaign = {
  metaCampaignId: string;
  name: string;
  objective: string;
  baseImpressions: number;
  baseSpend: number;
  baseConvRate: number; // 0.01–0.05
  hasVideo: boolean;
};

const CAMPAIGNS: SeedCampaign[] = [
  {
    metaCampaignId: `${SEED_PREFIX}cmp-vendas-blackfriday`,
    name: "Black Friday — Conversões",
    objective: "OUTCOME_SALES",
    baseImpressions: 45_000,
    baseSpend: 320,
    baseConvRate: 0.038,
    hasVideo: false,
  },
  {
    metaCampaignId: `${SEED_PREFIX}cmp-leads-webinar`,
    name: "Webinar — Captação de Leads",
    objective: "OUTCOME_LEADS",
    baseImpressions: 28_000,
    baseSpend: 180,
    baseConvRate: 0.025,
    hasVideo: true,
  },
  {
    metaCampaignId: `${SEED_PREFIX}cmp-awareness-marca`,
    name: "Awareness — Reconhecimento da Marca",
    objective: "OUTCOME_AWARENESS",
    baseImpressions: 95_000,
    baseSpend: 220,
    baseConvRate: 0.008,
    hasVideo: true,
  },
];

type SeedAdSet = {
  metaAdsetId: string;
  name: string;
  campaignId: string; // referência local (será substituído pelo id real)
  optimizationGoal: string;
  weight: number; // proporção do total da campanha (soma=1.0 por campanha)
};

type SeedAd = {
  metaAdId: string;
  name: string;
  adsetId: string;
  weight: number;
};

const ADSETS_BY_CMP: Record<string, { name: string; goal: string; weight: number }[]> = {
  [`${SEED_PREFIX}cmp-vendas-blackfriday`]: [
    { name: "Lookalike Compradores 1%", goal: "OFFSITE_CONVERSIONS", weight: 0.6 },
    { name: "Retargeting Carrinho Abandonado", goal: "OFFSITE_CONVERSIONS", weight: 0.4 },
  ],
  [`${SEED_PREFIX}cmp-leads-webinar`]: [
    { name: "Interesse Marketing Digital", goal: "LEAD_GENERATION", weight: 0.55 },
    { name: "Lookalike Webinar Anteriores", goal: "LEAD_GENERATION", weight: 0.45 },
  ],
  [`${SEED_PREFIX}cmp-awareness-marca`]: [
    { name: "Broad — 18-44 BR", goal: "REACH", weight: 0.7 },
    { name: "Engajadores Instagram 90d", goal: "REACH", weight: 0.3 },
  ],
};

const ADS_PER_ADSET = 2; // 2 criativos por adset

// ── Geradores de KPIs ─────────────────────────────────────────────────────

function generateKpis(opts: {
  baseImpressions: number;
  baseSpend: number;
  baseConvRate: number;
  hasVideo: boolean;
  weight: number;
  multiplier: number;
}) {
  const m = opts.weight * opts.multiplier;
  const impressions = Math.max(0, Math.round(opts.baseImpressions * m));
  const reach = Math.round(impressions * (0.55 + Math.random() * 0.2));
  const frequency = reach > 0 ? round4(impressions / reach) : 0;
  const ctr = 0.012 + Math.random() * 0.018; // 1.2%–3%
  const clicks = Math.round(impressions * ctr);
  const engagement = Math.round(clicks * (1.4 + Math.random() * 0.6));
  const spend = round2(opts.baseSpend * m);
  const cpm = impressions > 0 ? round4((spend / impressions) * 1000) : 0;
  const cpc = clicks > 0 ? round4(spend / clicks) : 0;
  const cpp = reach > 0 ? round4((spend / reach) * 1000) : 0;
  const conversions = Math.round(clicks * opts.baseConvRate * (0.85 + Math.random() * 0.3));
  const leads = Math.round(conversions * (0.6 + Math.random() * 0.2));
  const cpa = conversions > 0 ? round4(spend / conversions) : 0;
  const cpl = leads > 0 ? round4(spend / leads) : 0;
  const conversionValue = round2(conversions * (45 + Math.random() * 90));
  const conversionRate = clicks > 0 ? round4(conversions / clicks) : 0;
  const roas = spend > 0 ? round4(conversionValue / spend) : 0;
  const roi = spend > 0 ? round4((conversionValue - spend) / spend) : 0;

  // Vídeo
  const videoPlays = opts.hasVideo ? Math.round(impressions * (0.45 + Math.random() * 0.15)) : 0;
  const videoP25 = Math.round(videoPlays * 0.78);
  const videoP50 = Math.round(videoPlays * 0.55);
  const videoP75 = Math.round(videoPlays * 0.38);
  const videoP100 = Math.round(videoPlays * 0.22);
  const videoAvgWatchTime = opts.hasVideo ? round2(8 + Math.random() * 14) : 0;
  const cpv = videoPlays > 0 ? round4(spend / videoPlays) : 0;

  return {
    reach,
    impressions,
    frequency,
    clicks,
    ctr: round4(ctr),
    engagement,
    spend,
    cpm,
    cpc,
    cpp,
    cpl,
    cpa,
    cpv,
    conversions,
    leads,
    conversionValue,
    conversionRate,
    roas,
    roi,
    videoPlays,
    videoP25,
    videoP50,
    videoP75,
    videoP100,
    videoAvgWatchTime,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seed Meta Ads Demo — usuário: ${TARGET_EMAIL}\n`);

  // 1. Localiza usuário e org
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
  console.log(`✅ Usuário: ${user.name ?? user.email} (${user.id})`);
  console.log(`✅ Org:     ${org.name} (${org.id})\n`);

  // 2. Limpa registros do seed anterior (idempotência)
  console.log("🧹 Limpando seed anterior...");
  const deletedSnaps = await prisma.metaAdsKpiSnapshot.deleteMany({
    where: {
      organizationId: org.id,
      OR: [
        { entityId: { startsWith: SEED_PREFIX } },
        { entityId: AD_ACCOUNT_ID },
      ],
    },
  });
  // Cascata: deletar campaigns apaga adsets, ads e (via fk) snapshots órfãos
  const deletedCmps = await prisma.metaAdCampaign.deleteMany({
    where: {
      organizationId: org.id,
      metaCampaignId: { startsWith: SEED_PREFIX },
    },
  });
  console.log(
    `   - ${deletedSnaps.count} snapshots, ${deletedCmps.count} campanhas removidas\n`,
  );

  // 3. Cria campanhas, adsets, ads
  console.log("📦 Criando estrutura (campaigns/adsets/ads)...");
  const createdCampaigns: { id: string; data: SeedCampaign }[] = [];
  const createdAdsets: { id: string; meta: string; campaignId: string; data: SeedCampaign; weight: number; goal: string; name: string }[] = [];
  const createdAds: { id: string; meta: string; adsetId: string; campaignId: string; data: SeedCampaign; weight: number; name: string }[] = [];

  const now = new Date();
  const startTime = daysAgo(DAYS_BACK + 5);

  for (const cmp of CAMPAIGNS) {
    const created = await prisma.metaAdCampaign.create({
      data: {
        organizationId: org.id,
        metaCampaignId: cmp.metaCampaignId,
        adAccountId: AD_ACCOUNT_ID,
        name: cmp.name,
        objective: cmp.objective,
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        dailyBudget: cmp.baseSpend,
        startTime,
        lastSyncedAt: now,
      },
    });
    createdCampaigns.push({ id: created.id, data: cmp });

    const adsetDefs = ADSETS_BY_CMP[cmp.metaCampaignId];
    for (let i = 0; i < adsetDefs.length; i++) {
      const def = adsetDefs[i];
      const metaAdsetId = `${SEED_PREFIX}as-${cmp.metaCampaignId.split("-").pop()}-${i + 1}`;
      const adset = await prisma.metaAdSet.create({
        data: {
          organizationId: org.id,
          campaignId: created.id,
          metaAdsetId,
          name: def.name,
          status: "ACTIVE",
          effectiveStatus: "ACTIVE",
          optimizationGoal: def.goal,
          billingEvent: "IMPRESSIONS",
          dailyBudget: round2(cmp.baseSpend * def.weight),
          startTime,
          lastSyncedAt: now,
        },
      });
      createdAdsets.push({
        id: adset.id,
        meta: metaAdsetId,
        campaignId: created.id,
        data: cmp,
        weight: def.weight,
        goal: def.goal,
        name: def.name,
      });

      // 2 ads por adset
      for (let a = 1; a <= ADS_PER_ADSET; a++) {
        const metaAdId = `${SEED_PREFIX}ad-${metaAdsetId.replace(SEED_PREFIX, "")}-${a}`;
        // Thumbnail/preview placeholder royalty-free via picsum.photos.
        // Seed deriva do metaAdId pra ser estável entre re-runs.
        const seed = encodeURIComponent(metaAdId);
        const previewUrl = `https://picsum.photos/seed/${seed}/600/600`;
        const thumbnailUrl = `https://picsum.photos/seed/${seed}/200/200`;
        const ad = await prisma.metaAd.create({
          data: {
            organizationId: org.id,
            campaignId: created.id,
            adsetId: adset.id,
            metaAdId,
            name: `${def.name} — Criativo ${a}`,
            status: "ACTIVE",
            effectiveStatus: "ACTIVE",
            creativeId: `${SEED_PREFIX}cr-${a}`,
            creative: {
              thumbnail_url: thumbnailUrl,
              image_url: previewUrl,
              title: `${def.name} — Criativo ${a}`,
            },
            previewUrl,
            lastSyncedAt: now,
          },
        });
        createdAds.push({
          id: ad.id,
          meta: metaAdId,
          adsetId: adset.id,
          campaignId: created.id,
          data: cmp,
          weight: def.weight / ADS_PER_ADSET,
          name: ad.name,
        });
      }
    }
  }
  console.log(
    `   - ${createdCampaigns.length} campaigns / ${createdAdsets.length} adsets / ${createdAds.length} ads\n`,
  );

  // 4. Gera snapshots diários por nível
  console.log(`📊 Gerando snapshots × ${DAYS_BACK} dias...`);
  const snapshotsToCreate: any[] = [];

  for (let dayOffset = DAYS_BACK; dayOffset >= 1; dayOffset--) {
    const date = daysAgo(dayOffset);
    const mult = dayMultiplier(date);

    // ACCOUNT-level: agregado de todas campanhas
    let accountAgg = generateKpis({
      baseImpressions: 0,
      baseSpend: 0,
      baseConvRate: 0,
      hasVideo: false,
      weight: 0,
      multiplier: 0,
    });

    // CAMPAIGN-level + agrega para account
    for (const { data: cmp, id: campaignDbId } of createdCampaigns) {
      const cmpKpis = generateKpis({
        baseImpressions: cmp.baseImpressions,
        baseSpend: cmp.baseSpend,
        baseConvRate: cmp.baseConvRate,
        hasVideo: cmp.hasVideo,
        weight: 1,
        multiplier: mult,
      });
      snapshotsToCreate.push({
        organizationId: org.id,
        level: "CAMPAIGN" as const,
        entityId: cmp.metaCampaignId,
        entityName: cmp.name,
        date,
        ...cmpKpis,
      });
      // soma p/ account
      for (const k of Object.keys(cmpKpis) as (keyof typeof cmpKpis)[]) {
        (accountAgg as any)[k] = ((accountAgg as any)[k] ?? 0) + cmpKpis[k];
      }
      // toca silenciosamente — só pra não warn unused
      void campaignDbId;
    }

    // Reach do account não é soma direta (overlap), aproxima 78% da soma
    accountAgg.reach = Math.round(accountAgg.reach * 0.78);
    accountAgg.frequency = accountAgg.reach > 0 ? round4(accountAgg.impressions / accountAgg.reach) : 0;
    accountAgg.ctr = accountAgg.impressions > 0 ? round4(accountAgg.clicks / accountAgg.impressions) : 0;
    accountAgg.cpm = accountAgg.impressions > 0 ? round4((accountAgg.spend / accountAgg.impressions) * 1000) : 0;
    accountAgg.cpc = accountAgg.clicks > 0 ? round4(accountAgg.spend / accountAgg.clicks) : 0;
    accountAgg.spend = round2(accountAgg.spend);
    accountAgg.conversionValue = round2(accountAgg.conversionValue);

    snapshotsToCreate.push({
      organizationId: org.id,
      level: "ACCOUNT" as const,
      entityId: AD_ACCOUNT_ID,
      entityName: `Conta Demo (${org.name})`,
      date,
      ...accountAgg,
    });

    // ADSET-level
    for (const adset of createdAdsets) {
      snapshotsToCreate.push({
        organizationId: org.id,
        level: "ADSET" as const,
        entityId: adset.meta,
        entityName: adset.name,
        date,
        ...generateKpis({
          baseImpressions: adset.data.baseImpressions,
          baseSpend: adset.data.baseSpend,
          baseConvRate: adset.data.baseConvRate,
          hasVideo: adset.data.hasVideo,
          weight: adset.weight,
          multiplier: mult,
        }),
      });
    }

    // AD-level
    for (const ad of createdAds) {
      snapshotsToCreate.push({
        organizationId: org.id,
        level: "AD" as const,
        entityId: ad.meta,
        entityName: ad.name,
        date,
        ...generateKpis({
          baseImpressions: ad.data.baseImpressions,
          baseSpend: ad.data.baseSpend,
          baseConvRate: ad.data.baseConvRate,
          hasVideo: ad.data.hasVideo,
          weight: ad.weight,
          multiplier: mult,
        }),
      });
    }
  }

  // 5. Bulk insert
  const result = await prisma.metaAdsKpiSnapshot.createMany({
    data: snapshotsToCreate,
    skipDuplicates: true,
  });
  console.log(`   - ${result.count} snapshots inseridos\n`);

  // 6. Resumo final
  const totals = snapshotsToCreate.reduce(
    (acc, s) => {
      acc.impressions += s.impressions ?? 0;
      acc.clicks += s.clicks ?? 0;
      acc.spend += Number(s.spend ?? 0);
      acc.conversions += s.conversions ?? 0;
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
  );

  console.log("✨ Resumo agregado dos 30 dias:");
  console.log(`   Impressões:  ${totals.impressions.toLocaleString("pt-BR")}`);
  console.log(`   Cliques:     ${totals.clicks.toLocaleString("pt-BR")}`);
  console.log(`   Investido:   R$ ${totals.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log(`   Conversões:  ${totals.conversions.toLocaleString("pt-BR")}`);
  console.log("\n🌌 Pronto. Abra `/insights` e veja o painel Meta Insights.\n");
}

main()
  .catch((e) => {
    console.error("❌ Falha no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
