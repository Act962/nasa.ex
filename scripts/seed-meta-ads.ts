/**
 * Seed Meta Ads — campanhas fake + 30 dias de KPIs por campanha.
 * Não chama API da Meta; usa metaCampaignId fake (prefixo "fake_").
 *
 * Uso:
 *   npx tsx scripts/seed-meta-ads.ts            # primeira org
 *   npx tsx scripts/seed-meta-ads.ts <orgId>    # org específica
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  MetaAdEntityStatus,
  MetaAdLevel,
} from "../src/generated/prisma/enums";

const dbUrl = process.env.DATABASE_URL!;
const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
const adapter = new PrismaPg({
  connectionString: dbUrl,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
} as any);
const prisma = new PrismaClient({ adapter } as any);

const FAKE_AD_ACCOUNT = "act_seed_demo";

const CAMPAIGN_TEMPLATES: Array<{
  name: string;
  objective: string;
  status: MetaAdEntityStatus;
  dailyBudget: number;
  perfTier: "high" | "mid" | "low"; // afeta os números gerados
}> = [
  { name: "Black Friday — Conversões",   objective: "OUTCOME_SALES",      status: "ACTIVE",  dailyBudget: 150,  perfTier: "high" },
  { name: "Captura de Leads — Janeiro",  objective: "OUTCOME_LEADS",      status: "ACTIVE",  dailyBudget: 80,   perfTier: "high" },
  { name: "Tráfego Blog — Conteúdo",     objective: "OUTCOME_TRAFFIC",    status: "ACTIVE",  dailyBudget: 40,   perfTier: "mid"  },
  { name: "Brand Awareness Q1",          objective: "OUTCOME_AWARENESS",  status: "ACTIVE",  dailyBudget: 60,   perfTier: "mid"  },
  { name: "Reativação Audiência",        objective: "OUTCOME_ENGAGEMENT", status: "PAUSED",  dailyBudget: 25,   perfTier: "low"  },
  { name: "Teste Criativo — Vídeo",      objective: "OUTCOME_AWARENESS",  status: "PAUSED",  dailyBudget: 30,   perfTier: "low"  },
];

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function generateDailyKpis(tier: "high" | "mid" | "low", dailyBudget: number) {
  const base = tier === "high" ? 1 : tier === "mid" ? 0.6 : 0.3;
  const spend = dailyBudget * rnd(0.7, 1.05);
  const impressions = Math.round(rnd(8000, 25000) * base);
  const reach = Math.round(impressions * rnd(0.6, 0.85));
  const clicks = Math.round(impressions * rnd(0.012, 0.045) * (tier === "high" ? 1.3 : 1));
  const ctr = (clicks / impressions) * 100;
  const cpc = spend / Math.max(clicks, 1);
  const cpm = (spend / impressions) * 1000;
  const conversions = Math.round(clicks * rnd(0.04, 0.12) * (tier === "high" ? 1.5 : 1));
  const leads = tier === "high" ? Math.round(conversions * rnd(0.4, 0.7)) : Math.round(conversions * rnd(0.2, 0.4));
  const conversionValue = conversions * rnd(35, 180);
  const roas = spend > 0 ? conversionValue / spend : 0;
  const roi = spend > 0 ? ((conversionValue - spend) / spend) * 100 : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const cpp = (spend / reach) * 1000;
  const engagement = Math.round(clicks * rnd(2, 4));
  const videoPlays = Math.round(impressions * rnd(0.1, 0.35));
  const thruPlays = Math.round(videoPlays * rnd(0.3, 0.7));
  const cpv = videoPlays > 0 ? spend / videoPlays : 0;

  return {
    spend, impressions, reach, clicks, ctr, cpc, cpm, cpp,
    conversions, leads, conversionValue, conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    roas, roi, cpa, cpl, cpv,
    frequency: impressions / Math.max(reach, 1),
    engagement,
    videoPlays, thruPlays, avgWatchTime: rnd(8, 22),
  };
}

async function main() {
  const orgIdArg = process.argv[2];
  const org = orgIdArg
    ? await prisma.organization.findUnique({ where: { id: orgIdArg } })
    : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });

  if (!org) {
    console.error("❌ Nenhuma organização encontrada. Passe orgId como argumento ou crie uma.");
    process.exit(1);
  }

  console.log(`🚀 Seeding Meta Ads para org: ${org.name} (${org.id})`);

  // Limpa seeds antigos (só dessa org com prefixo "fake_")
  const oldCampaigns = await prisma.metaAdCampaign.findMany({
    where: { organizationId: org.id, metaCampaignId: { startsWith: "fake_" } },
    select: { id: true, metaCampaignId: true },
  });

  if (oldCampaigns.length > 0) {
    const ids = oldCampaigns.map((c) => c.id);
    const fakeMetaIds = oldCampaigns.map((c) => c.metaCampaignId!);

    // Apaga snapshots associados (level=CAMPAIGN com entityId = fake_*)
    await prisma.metaAdsKpiSnapshot.deleteMany({
      where: {
        organizationId: org.id,
        level: MetaAdLevel.CAMPAIGN,
        entityId: { in: fakeMetaIds },
      },
    });
    await prisma.metaAdCampaign.deleteMany({ where: { id: { in: ids } } });
    console.log(`🧹 Removidos ${oldCampaigns.length} seeds antigos (e snapshots)`);
  }

  // Cria campanhas
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let campaignCount = 0;
  let snapshotCount = 0;

  for (const tpl of CAMPAIGN_TEMPLATES) {
    const fakeMetaId = `fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const campaign = await prisma.metaAdCampaign.create({
      data: {
        organizationId: org.id,
        metaCampaignId: fakeMetaId,
        adAccountId: FAKE_AD_ACCOUNT,
        name: tpl.name,
        objective: tpl.objective,
        status: tpl.status,
        effectiveStatus: tpl.status,
        specialAdCategories: [],
        dailyBudget: tpl.dailyBudget,
        bidStrategy: "LOWEST_COST_WITHOUT_CAP",
        startTime: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        lastSyncedAt: new Date(),
      },
    });
    campaignCount++;

    // 30 dias de snapshots
    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);

      const k = generateDailyKpis(tpl.perfTier, tpl.dailyBudget);

      await prisma.metaAdsKpiSnapshot.create({
        data: {
          organizationId: org.id,
          level: MetaAdLevel.CAMPAIGN,
          entityId: fakeMetaId,
          entityName: tpl.name,
          date,
          datePreset: "daily",
          reach: k.reach,
          impressions: k.impressions,
          frequency: k.frequency,
          clicks: k.clicks,
          ctr: k.ctr,
          engagement: k.engagement,
          spend: k.spend,
          cpm: k.cpm,
          cpc: k.cpc,
          cpp: k.cpp,
          cpl: k.cpl,
          cpa: k.cpa,
          cpv: k.cpv,
          conversions: k.conversions,
          leads: k.leads,
          conversionValue: k.conversionValue,
          conversionRate: k.conversionRate,
          roas: k.roas,
          roi: k.roi,
          videoPlays: k.videoPlays,
          videoP25: Math.round(k.videoPlays * 0.7),
          videoP50: Math.round(k.videoPlays * 0.5),
          videoP75: Math.round(k.videoPlays * 0.35),
          videoP100: k.thruPlays,
          videoAvgWatchTime: k.avgWatchTime,
          syncedAt: new Date(),
        },
      });
      snapshotCount++;
    }

    console.log(`  ✓ ${tpl.name} (${tpl.status}) — 30 snapshots`);
  }

  console.log(`\n✅ Concluído: ${campaignCount} campanhas + ${snapshotCount} snapshots`);
  console.log(`   Acesse Insights → Gerenciar Campanhas Meta Ads`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
