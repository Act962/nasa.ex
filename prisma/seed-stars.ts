import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Plans ──────────────────────────────────────────────────────────────────
  await prisma.plan.upsert({
    where: { slug: "earth" },
    update: {},
    create: {
      slug: "earth",
      name: "Earth",
      monthlyStars: 500,
      priceMonthly: 149,
      maxUsers: 3,
      rolloverPct: 30,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "explore" },
    update: {},
    create: {
      slug: "explore",
      name: "Explore",
      monthlyStars: 2000,
      priceMonthly: 399,
      maxUsers: 10,
      rolloverPct: 30,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "constellation" },
    update: {},
    create: {
      slug: "constellation",
      name: "Constellation",
      monthlyStars: 999999,
      priceMonthly: 0,
      maxUsers: 999,
      rolloverPct: 0,
    },
  });

  // ── Star packages ──────────────────────────────────────────────────────────
  const packages = [
    { stars: 100, priceBrl: 19, label: "100 ★" },
    { stars: 500, priceBrl: 79, label: "500 ★" },
    { stars: 1000, priceBrl: 139, label: "1.000 ★" },
  ];

  for (const pkg of packages) {
    await prisma.starPackage.upsert({
      where: { id: `pkg_${pkg.stars}` },
      update: {},
      create: {
        id: `pkg_${pkg.stars}`,
        stars: pkg.stars,
        priceBrl: pkg.priceBrl,
        label: pkg.label,
      },
    });
  }

  // ── App star costs ─────────────────────────────────────────────────────────
  const appCosts = [
    { appSlug: "whatsapp-business",  monthlyCost: 80,  setupCost: 0,  priceBrl: 49 },
    { appSlug: "instagram-dm",       monthlyCost: 60,  setupCost: 0,  priceBrl: 49 },
    { appSlug: "telegram",           monthlyCost: 40,  setupCost: 0,  priceBrl: 0  },
    { appSlug: "facebook-messenger", monthlyCost: 60,  setupCost: 0,  priceBrl: 49 },
    { appSlug: "tiktok",             monthlyCost: 50,  setupCost: 20, priceBrl: 49 },
    { appSlug: "linkedin",           monthlyCost: 50,  setupCost: 20, priceBrl: 49 },
    { appSlug: "slack",              monthlyCost: 30,  setupCost: 0,  priceBrl: 0  },
    { appSlug: "kommo",              monthlyCost: 60,  setupCost: 30, priceBrl: 49 },
    { appSlug: "hubspot",            monthlyCost: 80,  setupCost: 30, priceBrl: 49 },
    { appSlug: "salesforce",         monthlyCost: 100, setupCost: 50, priceBrl: 49 },
    { appSlug: "pipedrive",          monthlyCost: 60,  setupCost: 20, priceBrl: 49 },
    { appSlug: "rd-station",         monthlyCost: 60,  setupCost: 20, priceBrl: 49 },
    { appSlug: "google-analytics",   monthlyCost: 20,  setupCost: 0,  priceBrl: 0  },
    { appSlug: "meta-ads",           monthlyCost: 40,  setupCost: 0,  priceBrl: 49 },
    { appSlug: "google-ads",         monthlyCost: 40,  setupCost: 0,  priceBrl: 49 },
    { appSlug: "openai",             monthlyCost: 60,  setupCost: 10, priceBrl: 49 },
    { appSlug: "typeform",           monthlyCost: 20,  setupCost: 0,  priceBrl: 0  },
    { appSlug: "hotmart",            monthlyCost: 40,  setupCost: 0,  priceBrl: 49 },
    { appSlug: "stripe",             monthlyCost: 30,  setupCost: 0,  priceBrl: 0  },
    { appSlug: "asaas",              monthlyCost: 30,  setupCost: 0,  priceBrl: 0  },
  ];

  for (const cost of appCosts) {
    await prisma.appStarCost.upsert({
      where: { appSlug: cost.appSlug },
      update: { monthlyCost: cost.monthlyCost, setupCost: cost.setupCost, priceBrl: cost.priceBrl },
      create: cost,
    });
  }

  console.log("✅ Stars seed concluído — plans, packages e app costs inseridos.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
