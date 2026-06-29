/**
 * Seed de Planos — NASA Subscription Plans
 *
 * Popula a tabela `Plan` com os 4 planos exibidos no modal de assinatura:
 * Suite (grátis), Earth, Explore (destaque) e Constellation.
 *
 * Rode com:  npx tsx prisma/seed-plans.ts
 *
 * 100% idempotente — usa upsert por slug.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const PLANS = [
  {
    slug: "suite",
    name: "Suite",
    slogan: "Para quem está dando os primeiros passos",
    sortOrder: 1,
    monthlyStars: 100,
    priceMonthly: 0,
    priceLabel: "Gratuito",
    billingType: "monthly",
    maxUsers: 3,
    rolloverPct: 0,
    highlighted: false,
    isActive: true,
    benefits: [
      "CRM completo e pipeline de vendas",
      "Usuários ilimitados – 30 ★ por usuário/mês",
      "Agenda e agendamentos",
    ],
    ctaLabel: "Selecionar",
  },
  {
    slug: "earth",
    name: "Earth",
    slogan: "Primeiros resultados com automação",
    sortOrder: 2,
    monthlyStars: 1000,
    priceMonthly: 197,
    billingType: "monthly",
    maxUsers: 10,
    rolloverPct: 0,
    highlighted: false,
    isActive: true,
    benefits: [
      "1000 ★ Stars mensal",
      "Suporte de integrações com o ASTRO",
      "Suporte prioritário por e-mail",
    ],
    ctaLabel: "Selecionar",
  },
  {
    slug: "explore",
    name: "Explore",
    slogan: "Para empresas que automatizam e crescem",
    sortOrder: 3,
    monthlyStars: 3000,
    priceMonthly: 397,
    billingType: "monthly",
    maxUsers: 80,
    rolloverPct: 25,
    highlighted: true,
    isActive: true,
    benefits: [
      "3000 ★ Stars mensais",
      "25% de rollover de Stars",
      "Suporta ~80 usuários ativos/mês",
    ],
    ctaLabel: "Selecionar",
  },
  {
    slug: "constellation",
    name: "Constellation",
    slogan: "Para empresas sem limites",
    sortOrder: 4,
    monthlyStars: 20000,
    priceMonthly: 0,
    priceLabel: "Sob consulta",
    billingType: "monthly",
    maxUsers: 500,
    rolloverPct: 30,
    highlighted: false,
    isActive: true,
    benefits: [
      "20000 Stars mensais",
      "30% de rollover de Stars",
      "Suporte ~500 usuários ativos /mês",
    ],
    ctaLabel: "Selecionar",
  },
];

async function main() {
  console.log("🚀 Seeding plans...\n");

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: plan,
    });
    console.log(`✔ Plan upserted: ${plan.name}`);
  }

  console.log("\n✅ Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
