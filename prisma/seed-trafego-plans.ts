/**
 * Seed do catálogo trafeGO. Idempotente por `slug` — rodar de novo atualiza
 * os valores em vez de duplicar.
 *
 * Uso: pnpm tsx prisma/seed-trafego-plans.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PLANS = [
  {
    slug: "meta-essencial",
    name: "Essencial",
    headline: "Para começar a aparecer na sua região",
    description:
      "Ideal para quem nunca anunciou. Nossa equipe monta a segmentação, publica e acompanha os primeiros resultados.",
    platform: "META_ADS" as const,
    campaignTypes: ["PROSPECCAO", "RECONHECIMENTO"] as const,
    objectives: ["LEADS", "TRAFFIC", "AWARENESS", "MESSAGES"] as const,
    adBudgetBrlCents: 30000,
    serviceFeePercent: 50,
    durationDays: 30,
    maxCreatives: 3,
    maxCopies: 2,
    highlights: [
      "R$ 300 investidos direto no anúncio",
      "Segmentação feita por especialista",
      "Relatório de desempenho no painel",
      "Suporte pelo painel",
    ],
    isDefault: false,
    position: 0,
  },
  {
    slug: "meta-crescimento",
    name: "Crescimento",
    headline: "Mais alcance e testes de criativo",
    description:
      "Para quem já validou o básico e quer escalar. Testamos variações de criativo e copy para achar o que rende mais.",
    platform: "META_ADS" as const,
    campaignTypes: ["PROSPECCAO", "REMARKETING", "VENDA_DIRETA"] as const,
    objectives: ["LEADS", "TRAFFIC", "SALES", "ENGAGEMENT", "MESSAGES"] as const,
    adBudgetBrlCents: 80000,
    serviceFeePercent: 50,
    durationDays: 30,
    maxCreatives: 6,
    maxCopies: 4,
    highlights: [
      "R$ 800 investidos direto no anúncio",
      "Teste A/B de criativos e copy",
      "Otimização semanal da campanha",
      "Público personalizado e remarketing",
      "Suporte prioritário pelo painel",
    ],
    isDefault: true,
    position: 1,
  },
  {
    slug: "meta-performance",
    name: "Performance",
    headline: "Volume e otimização contínua",
    description:
      "Para quem quer volume de leads ou vendas com acompanhamento próximo e ajustes frequentes.",
    platform: "META_ADS" as const,
    campaignTypes: [
      "PROSPECCAO",
      "REMARKETING",
      "VENDA_DIRETA",
      "RELACIONAMENTO",
    ] as const,
    objectives: ["LEADS", "TRAFFIC", "SALES", "ENGAGEMENT", "MESSAGES"] as const,
    adBudgetBrlCents: 200000,
    serviceFeePercent: 50,
    durationDays: 30,
    maxCreatives: 10,
    maxCopies: 6,
    highlights: [
      "R$ 2.000 investidos direto no anúncio",
      "Otimização contínua durante todo o período",
      "Múltiplos públicos e criativos em teste",
      "Relatório detalhado de performance",
      "Atendimento dedicado",
    ],
    isDefault: false,
    position: 2,
  },
  {
    slug: "whatsapp-disparo-essencial",
    name: "Disparo Essencial",
    headline: "Fale com sua lista pelo WhatsApp Oficial",
    description:
      "Envio em massa pela API oficial da Meta — sem risco de banimento do número. Nossa equipe monta o modelo e dispara.",
    platform: "WHATSAPP_OFICIAL" as const,
    campaignTypes: ["RELACIONAMENTO", "VENDA_DIRETA", "REMARKETING"] as const,
    objectives: ["BROADCAST"] as const,
    adBudgetBrlCents: 20000,
    serviceFeePercent: 50,
    durationDays: 15,
    maxCreatives: 2,
    maxCopies: 2,
    highlights: [
      "Envio pela API oficial (sem risco de ban)",
      "Modelo de mensagem aprovado pela Meta",
      "Relatório de entrega e leitura",
      "Suporte pelo painel",
    ],
    isDefault: false,
    position: 3,
  },
];

async function main() {
  for (const plan of PLANS) {
    const data = {
      ...plan,
      campaignTypes: [...plan.campaignTypes],
      objectives: [...plan.objectives],
      serviceFeeBrlCents: null,
      isActive: true,
    };
    await prisma.trafegoPlan.upsert({
      where: { slug: plan.slug },
      create: data,
      update: data,
    });
    const total = Math.round(
      plan.adBudgetBrlCents * (1 + plan.serviceFeePercent / 100),
    );
    console.log(
      `✓ ${plan.name.padEnd(20)} verba R$ ${(plan.adBudgetBrlCents / 100).toFixed(2).padStart(8)}  →  cliente paga R$ ${(total / 100).toFixed(2)}`,
    );
  }
  console.log(`\n${PLANS.length} planos no catálogo.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
