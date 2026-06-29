/**
 * Seed do catálogo global de Regras de Stars (`AppStarCost` com
 * `category="action"`).
 *
 * Popula a tabela com as 5 novas cobranças desta fase + um set base
 * a partir de `DEFAULT_STAR_RULES`. Idempotente: usa upsert.
 *
 * Como rodar:
 *   pnpm exec ts-node prisma/seed-star-rules.ts
 *
 * Após rodar, o admin pode ver/editar/criar regras em
 * `/admin/stars > Regras`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_STAR_RULES } from "../src/data/star-rules";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// `as any` segue o padrão dos outros seeds — type do PrismaClient ainda
// não conhece `adapter` como prop oficial.
const prisma = new PrismaClient({ adapter } as any);

// As 5 novas ações desta fase. Mesmo se DEFAULT_STAR_RULES não as
// tiver, queremos garantir que existam no catálogo após o seed.
const PHASE_1_NEW_RULES = [
  {
    appSlug: "astro_prompt",
    monthlyCost: 5,
    displayName: "Astro IA — prompt",
  },
  {
    appSlug: "insights_report_ai",
    monthlyCost: 10,
    displayName: "Insights — relatório com IA",
  },
  {
    appSlug: "workflow_execute",
    monthlyCost: 2,
    displayName: "Workflow executado",
  },
  {
    appSlug: "nasa_route_video_upload_complete",
    monthlyCost: 20,
    displayName: "NASA Route — vídeo de aula finalizado",
  },
  {
    appSlug: "calendar_share_enable",
    monthlyCost: 5,
    displayName: "Calendário público — ativação",
  },
];

async function main() {
  console.log("Seeding star action rules into AppStarCost...");

  let created = 0;
  let skipped = 0;

  // Fase 1 — as 5 novas obrigatórias
  for (const rule of PHASE_1_NEW_RULES) {
    const existing = await prisma.appStarCost.findUnique({
      where: { appSlug: rule.appSlug },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.appStarCost.create({
      data: {
        appSlug: rule.appSlug,
        monthlyCost: rule.monthlyCost,
        setupCost: 0,
        displayName: rule.displayName,
        category: "action",
        isPublic: true,
      },
    });
    created++;
  }

  // Demais ações do catálogo histórico (DEFAULT_STAR_RULES)
  for (const rule of DEFAULT_STAR_RULES) {
    const existing = await prisma.appStarCost.findUnique({
      where: { appSlug: rule.action },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.appStarCost.create({
      data: {
        appSlug: rule.action,
        monthlyCost: rule.stars,
        setupCost: 0,
        displayName: rule.label,
        category: "action",
        isPublic: true,
      },
    });
    created++;
  }

  console.log(`✓ Created ${created} new rules, skipped ${skipped} existing.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
