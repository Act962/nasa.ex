/**
 * Seed dos planos N.A.S.A — Earth / Explore (apenas teste)
 *
 * Stripe price IDs hardcoded — conta de teste, sem fallback de env var.
 * Suit (free) NÃO entra na tabela `plans` — é a ausência de `Organization.planId`.
 *
 * Como rodar:
 *  pnpm tsx --env-file=.env src/scripts/seed-plans.ts
 *
 *  (a flag --env-file é necessária — tsx não auto-carrega .env como o Next faz.
 *   Sem ela, Prisma estoura `SASL: client password must be a string`.)
 *
 * Idempotente: upsert por slug; re-rodar só atualiza campos divergentes.
 *
 * Ver: docs/subscription-org-model.md
 */

import prisma from "@/lib/prisma";

interface PlanSeed {
  slug: string;
  name: string;
  slogan: string;
  sortOrder: number;
  monthlyStars: number;
  priceMonthly: number;
  billingType: "monthly" | "annual" | "weekly";
  maxUsers: number;
  rolloverPct: number;
  benefits: string[];
  ctaLabel: string;
  ctaLink: string | null;
  highlighted: boolean;
  isActive: boolean;
  stripePriceId: string;
  stripeProductId?: string | null;
}

const PLANS: PlanSeed[] = [
  {
    slug: "earth",
    name: "Earth",
    slogan: "Primeiros resultados com automação",
    sortOrder: 1,
    monthlyStars: 1_000,
    priceMonthly: 197,
    billingType: "monthly",
    maxUsers: 26,
    rolloverPct: 20,
    benefits: [
      "Tudo do Suit, mais:",
      "1.000 Stars mensais",
      "20% de rollover de Stars",
      "Suporta ~26 usuários ativos/mês",
      "Relatórios básicos",
      "Suporte prioritário",
    ],
    ctaLabel: "Assinar Earth",
    ctaLink: null,
    highlighted: false,
    isActive: true,
    stripePriceId: "price_1TMp9CJAOLv8FwGwZxnMV3wd",
  },
  {
    slug: "explore",
    name: "Explore",
    slogan: "Para empresas que automatizam e crescem",
    sortOrder: 2,
    monthlyStars: 3_000,
    priceMonthly: 397,
    billingType: "monthly",
    maxUsers: 80,
    rolloverPct: 25,
    benefits: [
      "Tudo do Earth, mais:",
      "3.000 Stars mensais",
      "25% de rollover de Stars",
      "Suporta ~80 usuários ativos/mês",
      "IA ASTRO completo",
      "NASA Planner + Mind Maps",
      "Space Points gamificado",
      "Suporte dedicado",
    ],
    ctaLabel: "Assinar Explore",
    ctaLink: null,
    highlighted: true, // "MAIS POPULAR"
    isActive: true,
    stripePriceId: "price_1TMqNbJAOLv8FwGw7yw02K1Q",
  },
];

async function main() {
  console.log(`▶ Seed de planos — processando ${PLANS.length} tier(s)`);

  for (const seed of PLANS) {
    const data = {
      slug: seed.slug,
      name: seed.name,
      slogan: seed.slogan,
      sortOrder: seed.sortOrder,
      monthlyStars: seed.monthlyStars,
      priceMonthly: seed.priceMonthly,
      billingType: seed.billingType,
      maxUsers: seed.maxUsers,
      rolloverPct: seed.rolloverPct,
      benefits: seed.benefits,
      ctaLabel: seed.ctaLabel,
      ctaLink: seed.ctaLink,
      highlighted: seed.highlighted,
      isActive: seed.isActive,
      stripeProductId: seed.stripeProductId ?? null,
      stripePriceId: seed.stripePriceId,
    };

    const upserted = await prisma.plan.upsert({
      where: { slug: seed.slug },
      create: data,
      update: data,
    });

    console.log(
      `  ✅ ${upserted.slug.padEnd(10)} R$ ${upserted.priceMonthly
        .toString()
        .padStart(4)}/mês  ${upserted.monthlyStars
        .toString()
        .padStart(5)} ★  🟢 ${upserted.stripePriceId}`,
    );
  }

  console.log(`\n✓ Seed concluído.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Erro no seed:");
    console.error(e);
    process.exit(1);
  });
