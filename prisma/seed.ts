import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { DEFAULT_RULES } from "../src/app/router/space-point/defaults";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Plano Free ─────────────────────────────────────────────────────────────
  console.log("🌱 Criando/atualizando plano Free...");
  await prisma.plan.upsert({
    where: { slug: "free" },
    create: {
      slug:         "free",
      name:         "Free",
      slogan:       "Comece sem pagar nada",
      sortOrder:    0,
      monthlyStars: 100,
      priceMonthly: 0,
      billingType:  "monthly",
      maxUsers:     1,
      rolloverPct:  0,        // plano free não faz rollover
      benefits:     ["100 Stars por mês", "1 usuário", "Acesso básico à plataforma"],
      ctaLabel:     "Começar grátis",
      highlighted:  false,
      isActive:     true,
    },
    update: {
      name:         "Free",
      monthlyStars: 100,
      priceMonthly: 0,
      rolloverPct:  0,
      isActive:     true,
    },
  });
  console.log("✅ Plano Free pronto!");

  // ── Space Point Rules ───────────────────────────────────────────────────────
  console.log("🌱 Iniciando seed de Space Point Rules...");

  let inserted = 0;
  let updated = 0;

  for (const rule of DEFAULT_RULES) {
    const { category: _cat, ...data } = rule;

    const exists = await prisma.spacePointRule.findUnique({
      where: { action: rule.action },
    });

    await prisma.spacePointRule.upsert({
      where: { action: rule.action },
      create: data,
      update: data,
    });

    if (exists) {
      updated++;
    } else {
      inserted++;
    }
  }

  console.log(`✅ Seed concluído!`);
  console.log(`   Inseridas: ${inserted}`);
  console.log(`   Atualizadas: ${updated}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

