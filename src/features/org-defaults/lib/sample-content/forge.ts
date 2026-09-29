import "server-only";
import type { ForgeProduct } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { daysFromNow, sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

const SAMPLE_PRODUCTS = [
  {
    name: sampleName("Kit de boas-vindas"),
    sku: "EXEMPLO-001",
    unit: "un",
    description: "Caixa com os itens mais vendidos da loja, ideal para novos clientes.",
    value: "149.90",
    quantity: "2",
  },
  {
    name: sampleName("Consultoria de implantação"),
    sku: "EXEMPLO-002",
    unit: "h",
    description: "Hora de consultoria para configurar e treinar a equipe do cliente.",
    value: "180.00",
    quantity: "4",
  },
];

const SAMPLE_CONTRACT_CONTENT = [
  "CONTRATO DE PRESTAÇÃO DE SERVIÇOS (EXEMPLO)",
  "",
  "1. OBJETO: fornecimento do Kit de boas-vindas e de horas de consultoria de implantação.",
  "2. PRAZO: 12 meses a partir da data de início, renovável mediante acordo entre as partes.",
  "3. PAGAMENTO: em até 30 dias após a emissão da nota fiscal.",
  "4. RESCISÃO: qualquer das partes pode encerrar o contrato com aviso prévio de 30 dias.",
  "",
  "Este é um documento de exemplo. Edite ou exclua quando quiser.",
].join("\n");

export async function seedSampleForge(context: SampleSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const createdProducts: { product: ForgeProduct; quantity: string }[] = [];
    for (const sampleProduct of SAMPLE_PRODUCTS) {
      const product = await tx.forgeProduct.create({
        data: {
          organizationId: context.organizationId,
          name: sampleProduct.name,
          sku: sampleProduct.sku,
          unit: sampleProduct.unit,
          description: sampleProduct.description,
          value: sampleProduct.value,
          createdById: context.ownerUserId,
        },
      });
      createdProducts.push({ product, quantity: sampleProduct.quantity });
    }

    const lastProposal = await tx.forgeProposal.findFirst({
      where: { organizationId: context.organizationId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const proposal = await tx.forgeProposal.create({
      data: {
        organizationId: context.organizationId,
        title: sampleName("Proposta comercial"),
        number: (lastProposal?.number ?? 0) + 1,
        status: "RASCUNHO",
        responsibleId: context.ownerUserId,
        participants: [],
        validUntil: daysFromNow(15, 23, 59),
        description: "Proposta de exemplo com dois produtos. Ajuste valores e envie ao seu cliente.",
        headerConfig: {},
        createdById: context.ownerUserId,
        products: {
          create: createdProducts.map(({ product, quantity }, index) => ({
            productId: product.id,
            quantity,
            unitValue: product.value,
            order: index,
          })),
        },
      },
    });

    const lastContract = await tx.forgeContract.findFirst({
      where: { organizationId: context.organizationId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const proposalTotal = createdProducts.reduce(
      (total, { product, quantity }) => total + Number(product.value) * Number(quantity),
      0,
    );

    await tx.forgeContract.create({
      data: {
        organizationId: context.organizationId,
        proposalId: proposal.id,
        number: (lastContract?.number ?? 0) + 1,
        startDate: daysFromNow(7, 0),
        endDate: daysFromNow(372, 0),
        value: proposalTotal.toFixed(2),
        status: "PENDENTE_ASSINATURA",
        content: SAMPLE_CONTRACT_CONTENT,
        signers: [
          {
            name: "Maria Oliveira (exemplo)",
            email: "maria.oliveira@example.com",
            signed_at: null,
            token: crypto.randomUUID(),
          },
        ],
        clientData: {
          name: "Mercadinho Bom Preço (exemplo)",
          document: "",
          email: "contato@example.com",
          phone: "(86) 99999-0000",
          address: "Rua das Flores, 123 - Centro",
          contactName: "Maria Oliveira",
        },
        createdById: context.ownerUserId,
      },
    });
  });
}
