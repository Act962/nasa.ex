import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { DEFAULT_RULES } from "../src/app/router/space-point/defaults";
import {
  DEFAULT_JOB_TITLES,
  DEFAULT_SKILLS,
  DEFAULT_TOOLS,
} from "../src/app/router/space-page/defaults";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seedSpacePointRules() {
  // SpacePointRule passou a ser per-org (unique [orgId, action]).
  // O seed das regras agora é feito por org via `ensureGlobalSpacePointRules`
  // em src/app/router/space-point/utils.ts no momento da primeira awardPoints.
  // Mantemos a função para compatibilidade do pipeline de seed.
  console.log("🌱 Space Point Rules — pulando (per-org, lazy via awardPoints)");
  void DEFAULT_RULES;
}

async function seedJobTitles() {
  console.log("🌱 Job Title Catalog...");
  let inserted = 0;
  let updated = 0;

  for (const job of DEFAULT_JOB_TITLES) {
    const exists = await prisma.jobTitleCatalog.findUnique({
      where: { slug: job.slug },
    });

    await prisma.jobTitleCatalog.upsert({
      where: { slug: job.slug },
      create: job,
      update: {
        title: job.title,
        category: job.category,
        level: job.level,
      },
    });

    if (exists) updated++;
    else inserted++;
  }

  console.log(
    `   ✅ Job Titles — inseridos: ${inserted}, atualizados: ${updated}`,
  );
}

async function seedSkills() {
  console.log("🌱 Skills...");
  let inserted = 0;
  let updated = 0;

  for (const skill of DEFAULT_SKILLS) {
    const exists = await prisma.skill.findUnique({
      where: { slug: skill.slug },
    });

    await prisma.skill.upsert({
      where: { slug: skill.slug },
      create: skill,
      update: { name: skill.name },
    });

    if (exists) updated++;
    else inserted++;
  }

  console.log(`   ✅ Skills — inseridas: ${inserted}, atualizadas: ${updated}`);
}

async function seedTools() {
  console.log("🌱 Tool Catalog...");
  let inserted = 0;
  let updated = 0;

  for (const tool of DEFAULT_TOOLS) {
    const exists = await prisma.toolCatalog.findUnique({
      where: { slug: tool.slug },
    });

    await prisma.toolCatalog.upsert({
      where: { slug: tool.slug },
      create: tool,
      update: {
        name: tool.name,
        category: tool.category,
        iconUrl: tool.iconUrl,
      },
    });

    if (exists) updated++;
    else inserted++;
  }

  console.log(`   ✅ Tools — inseridas: ${inserted}, atualizadas: ${updated}`);
}

async function runSafe(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`   ⚠️  ${label} falhou — pulando.`);
    console.warn(`       ${msg.split("\n")[0]}`);
  }
}

async function main() {
  console.log("🚀 Iniciando seed...\n");

  // SpacePointRule seeding depende de orgId (schema mudou p/ compound unique).
  // Mantemos a chamada por compatibilidade, mas sem bloquear os demais seeds.
  await runSafe("Space Point Rules", seedSpacePointRules);
  await runSafe("Job Titles", seedJobTitles);
  await runSafe("Skills", seedSkills);
  await runSafe("Tools", seedTools);

  console.log("\n✅ Seed concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
