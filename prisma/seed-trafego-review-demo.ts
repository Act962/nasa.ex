// Pedidos de demonstração do trafeGO na org GOTHAN CODEX, um em cada etapa da avaliação do Claude
// (spec 0132), para conferir o painel do cliente, o admin e a fila do MCP. Só banco de desenvolvimento.
// Todos os códigos começam com TG-DR: o --cleanup apaga só eles.
//
//   pnpm tsx --conditions=react-server prisma/seed-trafego-review-demo.ts            # simulação
//   pnpm tsx --conditions=react-server prisma/seed-trafego-review-demo.ts --apply    # grava
//   pnpm tsx --conditions=react-server prisma/seed-trafego-review-demo.ts --cleanup  # apaga

import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });
loadEnv({ path: ".env.local", quiet: true });

const ORG_NAME = "GOTHAN CODEX";
const CODE_PREFIX = "TG-DR";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type DemoStage =
  | "waiting_review"
  | "waiting_review_late"
  | "changes_fixes"
  | "changes_notes"
  | "approved_waiting_client"
  | "released"
  | "released_future_start"
  | "running";

interface DemoOrder {
  stage: DemoStage;
  business: string;
  niche: string;
  audience: string;
  budgetBrl: number;
  message: string;
  headline: string;
  summary?: string;
  fixes?: Record<string, string>;
  notes?: string[];
}

const DEMO_ORDERS: DemoOrder[] = [
  {
    stage: "waiting_review",
    business: "Clínica Visão Clara",
    niche: "Oftalmologia",
    audience: "Gênero: Todos · Idade: 45 a 75 anos · Localização: Teresina",
    budgetBrl: 600,
    message: "Consulta de catarata com avaliação completa em Teresina. Fale com a gente pelo WhatsApp.",
    headline: "Avaliação de catarata",
  },
  {
    stage: "waiting_review_late",
    business: "Pet Shop Patas",
    niche: "Pet",
    audience: "Gênero: Todos · Idade: 25 a 55 anos · Localização: Parnaíba",
    budgetBrl: 300,
    message: "Banho e tosa com hora marcada. Busca e entrega grátis no centro.",
    headline: "Banho e tosa",
  },
  {
    stage: "changes_fixes",
    business: "Academia Força Total",
    niche: "Fitness",
    audience: "Gênero: Todos · Idade: 18 a 24 anos · Localização: Piripiri",
    budgetBrl: 450,
    message: "Perca 10 kg em 30 dias garantido! Matricule-se já.",
    headline: "Resultado garantido",
    summary: "O texto promete resultado garantido, o que a Meta reprova, e o público está estreito demais para a verba.",
    fixes: {
      message: "Treine com acompanhamento de professor em todos os horários. Venha conhecer a Força Total.",
      headline: "Aula experimental grátis",
      audience: "Gênero: Todos · Idade: 18 a 45 anos · Localização: Piripiri",
    },
  },
  {
    stage: "changes_notes",
    business: "Doceria Mel & Cia",
    niche: "Alimentação",
    audience: "Gênero: Todos · Idade: 25 a 55 anos · Localização: Teresina",
    budgetBrl: 300,
    message: "Bolos de aniversário sob encomenda. Peça o seu pelo WhatsApp.",
    headline: "Bolos sob encomenda",
    summary: "O texto está bom, mas a foto está escura e o bolo quase não aparece.",
    fixes: { headline: "Bolo de aniversário sob encomenda" },
    notes: ["Troque a foto por uma mais clara, com o bolo inteiro aparecendo", "Evite texto escrito em cima da foto"],
  },
  {
    stage: "approved_waiting_client",
    business: "Ótica Bom Olhar",
    niche: "Ótica",
    audience: "Gênero: Todos · Idade: 30 a 65 anos · Localização: Teresina",
    budgetBrl: 500,
    message: "Óculos de grau com exame de vista na hora. Parcelamos em até 10x.",
    headline: "Exame de vista na hora",
    summary: "Anúncio claro, oferta visível e público bem escolhido para a verba. Pode publicar.",
  },
  {
    stage: "released",
    business: "Barbearia Navalha",
    niche: "Beleza",
    audience: "Gênero: Homens · Idade: 18 a 45 anos · Localização: Teresina",
    budgetBrl: 300,
    message: "Corte e barba com hora marcada pelo WhatsApp. Sem fila.",
    headline: "Corte sem fila",
    summary: "Tudo certo: texto direto e público coerente com o serviço.",
  },
  {
    stage: "released_future_start",
    business: "Escola de Inglês Talk",
    niche: "Educação",
    audience: "Gênero: Todos · Idade: 16 a 40 anos · Localização: Teresina",
    budgetBrl: 800,
    message: "Matrículas abertas para turmas de dezembro. Aula experimental pelo WhatsApp.",
    headline: "Turmas de dezembro",
    summary: "Anúncio pronto. Fica agendado para o dia de início que você escolheu.",
  },
  {
    stage: "running",
    business: "Lava Jato Brilho",
    niche: "Automotivo",
    audience: "Gênero: Todos · Idade: 20 a 60 anos · Localização: Teresina",
    budgetBrl: 300,
    message: "Lavagem completa com cera em 40 minutos. Agende pelo WhatsApp.",
    headline: "Lavagem em 40 min",
    summary: "Anúncio aprovado sem ajustes.",
  },
];

const STATUS_BY_STAGE = {
  waiting_review: "IN_REVIEW",
  waiting_review_late: "IN_REVIEW",
  changes_fixes: "CHANGES_REQUESTED",
  changes_notes: "CHANGES_REQUESTED",
  approved_waiting_client: "SCHEDULED",
  released: "SCHEDULED",
  released_future_start: "SCHEDULED",
  running: "RUNNING",
} as const;

async function main() {
  const { default: prisma } = await import("../src/lib/prisma");
  const { computeOrderFingerprint } = await import("../src/features/trafego/server/lib/order-review");
  const mode = process.argv.includes("--cleanup") ? "cleanup" : process.argv.includes("--apply") ? "apply" : "dry-run";

  try {
    const existing = await prisma.trafegoOrder.findMany({ where: { code: { startsWith: CODE_PREFIX } }, select: { id: true, code: true } });
    if (mode === "cleanup") {
      const { count } = await prisma.trafegoOrder.deleteMany({ where: { code: { startsWith: CODE_PREFIX } } });
      console.log(`Apagados ${count} pedidos ${CODE_PREFIX}*.`);
      return;
    }
    if (existing.length > 0) {
      console.log(`Já existem ${existing.length} pedidos ${CODE_PREFIX}*. Rode --cleanup antes.`);
      return;
    }

    const organization = await prisma.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
    const owner = await prisma.member.findFirstOrThrow({
      where: { organizationId: organization.id, role: "owner" },
      select: { userId: true },
    });

    if (mode === "dry-run") {
      DEMO_ORDERS.forEach((demo, index) => console.log(`${CODE_PREFIX}${String(index + 1).padStart(2, "0")} · ${demo.business} · ${demo.stage}`));
      console.log("\nSimulação. Use --apply para gravar.");
      return;
    }

    const now = Date.now();
    for (const [index, demo] of DEMO_ORDERS.entries()) {
      const code = `${CODE_PREFIX}${String(index + 1).padStart(2, "0")}`;
      const status = STATUS_BY_STAGE[demo.stage];
      const createdAt = new Date(now - (8 - index) * HOUR_MS);
      const budgetCents = demo.budgetBrl * 100;
      const serviceFeeCents = Math.max(15_000, Math.round(budgetCents * 0.3));
      const reviewRequestedAt = new Date(now - (demo.stage === "waiting_review_late" ? 5 * HOUR_MS : 40 * 60 * 1000));

      const order = await prisma.trafegoOrder.create({
        data: {
          code,
          organizationId: organization.id,
          ownerUserId: owner.userId,
          planNameSnapshot: `Tráfego R$ ${demo.budgetBrl},00`,
          campaignType: "PROSPECCAO",
          platform: "META_ADS",
          objective: "MESSAGES",
          durationDays: 30,
          maxCreatives: 3,
          maxCopies: 3,
          adBudgetBrlCents: budgetCents,
          serviceFeeBrlCents: serviceFeeCents,
          totalBrlCents: serviceFeeCents,
          status,
          businessName: demo.business,
          businessNiche: demo.niche,
          targetAudience: demo.audience,
          desiredStartAt: demo.stage === "released_future_start" ? new Date(now + 10 * DAY_MS) : null,
          startedAt: demo.stage === "running" ? new Date(now - HOUR_MS) : null,
          endsAt: demo.stage === "running" ? new Date(now + 30 * DAY_MS) : null,
          reviewRequestedAt,
          internalNotes: "pedido de demonstração da avaliação do Claude (spec 0132) — não operar",
          createdAt,
          copies: { create: { primaryText: demo.message, headline: demo.headline, isSelected: true } },
        },
        select: { id: true },
      });

      const fingerprint = demo.stage === "waiting_review" || demo.stage === "waiting_review_late" ? null : await computeOrderFingerprint(order.id);
      await prisma.trafegoOrder.update({
        where: { id: order.id },
        data: { reviewFingerprint: fingerprint, reviewFixes: demo.fixes ?? undefined, reviewNotes: demo.notes ?? [] },
      });

      const events: Parameters<typeof prisma.trafegoOrderEvent.createMany>[0]["data"] = [
        {
          orderId: order.id,
          fromStatus: "MATERIALS_SUBMITTED",
          toStatus: "IN_REVIEW",
          title: "Seu anúncio está na avaliação da equipe",
          detail: "A equipe avalia seu anúncio em até 2 horas. Você recebe um aviso quando terminar.",
          isClientVisible: true,
          source: "SYSTEM",
          createdAt: reviewRequestedAt,
        },
      ];
      if (demo.summary) {
        const isApproved = status !== "CHANGES_REQUESTED";
        const improvements = [
          ...Object.entries(demo.fixes ?? {}).map(([field, value]) => `${field === "audience" ? "Público" : field === "headline" ? "Título" : "Texto do anúncio"}: ${value}`),
          ...(demo.notes ?? []),
        ];
        const isReleased = demo.stage === "released" || demo.stage === "released_future_start" || demo.stage === "running";
        events.push({
          orderId: order.id,
          fromStatus: "IN_REVIEW",
          toStatus: isApproved ? "SCHEDULED" : "CHANGES_REQUESTED",
          title: isApproved ? "Anúncio aprovado — falta você liberar a publicação" : "A equipe pediu ajustes no anúncio",
          detail: [demo.summary, ...improvements.map((item) => `• ${item}`)].join("\n"),
          isClientVisible: true,
          source: "ADMIN",
          requiresApproval: true,
          approvedAt: isReleased ? new Date(now - 20 * 60 * 1000) : null,
          approvedByUserId: isReleased ? owner.userId : null,
          createdAt: new Date(reviewRequestedAt.getTime() + 30 * 60 * 1000),
        });
      }
      if (demo.stage === "running") {
        events.push({
          orderId: order.id,
          fromStatus: "SCHEDULED",
          toStatus: "RUNNING",
          title: "Seu anúncio está no ar",
          detail: "A equipe publicou a campanha. A Meta ainda revisa o anúncio antes de começar a entregar.",
          isClientVisible: true,
          source: "ADMIN",
          createdAt: new Date(now - HOUR_MS),
        });
      }
      await prisma.trafegoOrderEvent.createMany({ data: events });
      console.log(`${code} · ${demo.business} · ${demo.stage}`);
    }
    console.log(`\n${DEMO_ORDERS.length} pedidos criados na ${ORG_NAME}.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Os módulos do servidor deixam conexões abertas (Inngest, Pusher): sai explicitamente.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
