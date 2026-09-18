/**
 * Dados de demonstração do FORGE.
 *
 * Cria uma conta isolada com propostas públicas para validação visual:
 *   pnpm exec tsx prisma/seed-forge-proposal-demo.ts
 *
 * É idempotente: pode ser executado novamente sem duplicar a conta, produtos
 * ou propostas.
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO = {
  email: "teste.propostas@nasaex.local",
  password: "NasaTeste!2026",
  organizationSlug: "laboratorio-propostas-demo",
} as const;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function image(title: string, start: string, end: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="980" cy="150" r="240" fill="white" fill-opacity=".12"/><circle cx="150" cy="780" r="280" fill="white" fill-opacity=".08"/><text x="90" y="450" fill="white" font-family="Arial, sans-serif" font-size="74" font-weight="700">${title}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function main() {
  const now = new Date();
  const password = await hashPassword(DEMO.password);

  const user = await prisma.user.upsert({
    where: { email: DEMO.email },
    update: { name: "Pessoa de Testes — Propostas", isActive: true },
    create: {
      name: "Pessoa de Testes — Propostas",
      email: DEMO.email,
      emailVerified: true,
      isActive: true,
    },
  });

  await prisma.account.upsert({
    where: { id: `credential-${user.id}` },
    update: { password },
    create: {
      id: `credential-${user.id}`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: DEMO.organizationSlug },
    update: { name: "Ateliê Aurora — Demonstração" },
    create: {
      name: "Ateliê Aurora — Demonstração",
      slug: DEMO.organizationSlug,
      createdAt: now,
    },
  });

  await prisma.member.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: { role: "owner", cargo: "Direção comercial" },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
      cargo: "Direção comercial",
      createdAt: now,
    },
  });

  await prisma.forgeSettings.upsert({
    where: { organizationId: organization.id },
    update: { logoUrl: image("AURORA", "#4c1d95", "#7c3aed") },
    create: {
      organizationId: organization.id,
      logoUrl: image("AURORA", "#4c1d95", "#7c3aed"),
      proposalBgColor: "#ffffff",
      typographyColor: "#111827",
    },
  });

  const products = await Promise.all([
    prisma.forgeProduct.upsert({
      where: {
        organizationId_sku: {
          organizationId: organization.id,
          sku: "BRAND-01",
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        createdById: user.id,
        sku: "BRAND-01",
        name: "Identidade visual estratégica",
        unit: "projeto",
        value: "4800",
        description:
          "Sistema visual completo para uma marca coerente e reconhecível.",
        imageUrl: image("IDENTIDADE", "#0f172a", "#475569"),
      },
    }),
    prisma.forgeProduct.upsert({
      where: {
        organizationId_sku: { organizationId: organization.id, sku: "WEB-01" },
      },
      update: {},
      create: {
        organizationId: organization.id,
        createdById: user.id,
        sku: "WEB-01",
        name: "Landing page de conversão",
        unit: "projeto",
        value: "6200",
        description:
          "Página responsiva com mensagem, prova e CTA voltados à conversão.",
        imageUrl: image("CONVERSÃO", "#0f766e", "#14b8a6"),
      },
    }),
    prisma.forgeProduct.upsert({
      where: {
        organizationId_sku: {
          organizationId: organization.id,
          sku: "GROWTH-01",
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        createdById: user.id,
        sku: "GROWTH-01",
        name: "Plano de crescimento trimestral",
        unit: "trimestre",
        value: "3600",
        description:
          "Ritual de planejamento, acompanhamento de indicadores e otimização mensal.",
        imageUrl: image("CRESCIMENTO", "#9a3412", "#f97316"),
      },
    }),
  ]);

  const proposals = [
    {
      number: 1,
      token: "demo-proposta-estrategia-2026",
      title: "Estratégia de marca e presença digital",
      description:
        "<p>Uma proposta comercial pensada para mostrar um escopo amplo sem perder legibilidade.</p><p>O projeto organiza posicionamento, identidade e uma página preparada para transformar interesse em oportunidade.</p>",
      discount: "1000",
      discountType: "FIXO" as const,
      items: [
        { productId: products[0].id, unitValue: "4800" },
        { productId: products[1].id, unitValue: "6200" },
        { productId: products[2].id, unitValue: "3600" },
      ],
    },
    {
      number: 2,
      token: "demo-proposta-landing-2026",
      title: "Landing page para nova campanha",
      description:
        "<p>Exemplo compacto para conferir o comportamento do modelo com apenas um serviço, imagem em destaque e card de investimento.</p>",
      discount: null,
      discountType: null,
      items: [{ productId: products[1].id, unitValue: "6200" }],
    },
  ];

  for (const proposal of proposals) {
    const existing = await prisma.forgeProposal.findUnique({
      where: {
        organizationId_number: {
          organizationId: organization.id,
          number: proposal.number,
        },
      },
      select: { id: true },
    });
    const data = {
      title: proposal.title,
      status: "ENVIADA" as const,
      responsibleId: user.id,
      participants: [],
      validUntil: new Date("2027-12-31T23:59:59.000Z"),
      description: proposal.description,
      discount: proposal.discount,
      discountType: proposal.discountType,
      publicToken: proposal.token,
      createdById: user.id,
    };

    if (existing) {
      await prisma.$transaction([
        prisma.forgeProposal.update({ where: { id: existing.id }, data }),
        prisma.forgeProposalProduct.deleteMany({
          where: { proposalId: existing.id },
        }),
        prisma.forgeProposalProduct.createMany({
          data: proposal.items.map((item, order) => ({
            proposalId: existing.id,
            productId: item.productId,
            quantity: "1",
            unitValue: item.unitValue,
            order,
          })),
        }),
      ]);
    } else {
      await prisma.forgeProposal.create({
        data: {
          ...data,
          organizationId: organization.id,
          number: proposal.number,
          products: {
            create: proposal.items.map((item, order) => ({
              productId: item.productId,
              quantity: "1",
              unitValue: item.unitValue,
              order,
            })),
          },
        },
      });
    }
  }

  console.log("Conta de teste e propostas criadas.");
  console.log(`Login: ${DEMO.email}`);
  console.log(`Senha: ${DEMO.password}`);
  console.log("Propostas públicas:");
  console.log("/proposta/demo-proposta-estrategia-2026");
  console.log("/proposta/demo-proposta-landing-2026");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
