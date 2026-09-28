import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireSystemAdminMiddleware } from "@/app/middlewares/system-admin";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { getMonetarySettings } from "@/features/stars/lib/metering/fx";
import { FALLBACK_USD_TO_BRL } from "@/features/ia/lib/token-pricing";
import {
  computeSimulation,
  computeBid,
  type CostSimulatorInput,
  type SimulatorWhatsappLine,
  type SimulatorOperationalLine,
  type PriceCategory,
  type PriceUnit,
  type PriceCurrency,
  type WhatsappCategory,
  WHATSAPP_CATEGORIES,
} from "@/features/forge/lib/cost-simulator";
import {
  createSimulationSchema,
  updateSimulationSchema,
} from "@/features/forge/schema/simulator-schema";

type SimulationPayload = z.infer<typeof createSimulationSchema>;

const num = (value: unknown): number => Number(value ?? 0);

// Resolve as taxas do catálogo e monta a entrada do motor Comercial.
async function buildCommercialInput(
  payload: SimulationPayload,
  orgId: string,
  rate: number,
): Promise<{ input: CostSimulatorInput; aiModelCode: string | null }> {
  const ids = [
    payload.aiPriceItemId ?? undefined,
    ...(payload.whatsapp ?? []).map((line) => line.priceItemId),
    ...(payload.operational ?? []).map((line) => line.priceItemId),
  ].filter((id): id is string => Boolean(id));

  const items = ids.length
    ? await prisma.forgePriceItem.findMany({
        where: { id: { in: ids }, organizationId: orgId },
      })
    : [];
  const byId = new Map(items.map((item) => [item.id, item]));

  const aiItem = payload.aiPriceItemId ? byId.get(payload.aiPriceItemId) : undefined;
  const ai = aiItem
    ? {
        modelCode: aiItem.code ?? aiItem.name,
        inputPer1kUsd: num(aiItem.inputPer1k),
        outputPer1kUsd: num(aiItem.outputPer1k),
        cachedInputPer1kUsd: aiItem.cachedInputPer1k ? num(aiItem.cachedInputPer1k) : undefined,
        inputTokensPerUser: payload.inputTokensPerUser ?? 0,
        outputTokensPerUser: payload.outputTokensPerUser ?? 0,
        cachedTokensPerUser: payload.cachedTokensPerUser ?? 0,
      }
    : null;

  const whatsapp: SimulatorWhatsappLine[] = payload.whatsappEnabled
    ? (payload.whatsapp ?? []).flatMap((line) => {
        const item = byId.get(line.priceItemId);
        if (!item) return [];
        const category = item.code as WhatsappCategory;
        if (!WHATSAPP_CATEGORIES.includes(category)) return [];
        return [
          {
            category,
            pricePerConversation: num(item.unitPrice),
            currency: item.currency as PriceCurrency,
            conversationsPerUser: line.conversationsPerUser,
          },
        ];
      })
    : [];

  const operational: SimulatorOperationalLine[] = (payload.operational ?? []).flatMap((line) => {
    const item = byId.get(line.priceItemId);
    if (!item) return [];
    return [
      {
        priceItemId: item.id,
        category: item.category as PriceCategory,
        label: item.name,
        unit: item.unit as PriceUnit,
        unitPrice: num(item.unitPrice),
        currency: item.currency as PriceCurrency,
        quantity: line.quantity,
      },
    ];
  });

  return {
    input: {
      userCount: payload.userCount ?? 1,
      ai,
      whatsapp,
      operational,
      markupPercentage: payload.markupPercentage ?? 0,
      usdToBrlRate: rate,
    },
    aiModelCode: ai?.modelCode ?? null,
  };
}

const simulationSummaryShape = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.string(),
  internalCostTotal: z.string(),
  clientPriceTotal: z.string(),
  markupPercentage: z.string(),
  proposalId: z.string().nullable(),
  computedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listForgeSimulations = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "GET", summary: "List forge simulations", tags: ["Forge"] })
  .input(z.object({ mode: z.enum(["COMERCIAL", "LICITACAO"]).optional() }))
  .output(z.object({ simulations: z.array(simulationSummaryShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const simulations = await prisma.forgeSimulation.findMany({
        where: {
          organizationId: context.org.id,
          ...(input.mode ? { mode: input.mode } : {}),
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          mode: true,
          internalCostTotal: true,
          clientPriceTotal: true,
          markupPercentage: true,
          proposalId: true,
          computedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return {
        simulations: simulations.map((sim) => ({
          ...sim,
          internalCostTotal: sim.internalCostTotal.toString(),
          clientPriceTotal: sim.clientPriceTotal.toString(),
          markupPercentage: sim.markupPercentage.toString(),
        })),
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const getForgeSimulation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "GET", summary: "Get forge simulation", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ simulation: z.any() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const simulation = await prisma.forgeSimulation.findFirst({
        where: { id: input.id, organizationId: context.org.id },
        include: { lineItems: { orderBy: { order: "asc" } }, bidItems: { orderBy: { order: "asc" } } },
      });
      if (!simulation) throw errors.NOT_FOUND;
      return { simulation };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) throw err;
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// Persiste (create/update) recomputando sempre no servidor.
async function persistSimulation(
  payload: SimulationPayload,
  orgId: string,
  userId: string,
  simulationId?: string,
) {
  // Câmbio compartilhado; se a infra ainda não tem a coluna (deriva de migração
  // conhecida neste projeto), cai no fallback em vez de derrubar a simulação.
  let usdToBrlRate = FALLBACK_USD_TO_BRL;
  try {
    usdToBrlRate = (await getMonetarySettings()).usdToBrlRate;
  } catch (err) {
    console.warn("[forge/simulations] getMonetarySettings falhou, usando fallback", err);
  }

  if (payload.mode === "LICITACAO") {
    const bid = computeBid({
      contractMonths: payload.contractMonths ?? 12,
      markupPercentage: payload.markupPercentage ?? 0,
      ceilingTotalBrl: payload.ceilingTotalBrl ?? null,
      items: (payload.bidItems ?? []).map((item, index) => ({
        code: item.code,
        parentCode: item.parentCode ?? null,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        internalUnitCostBrl: item.internalUnitCostBrl,
        markupPercentage: item.markupPercentage ?? null,
        ceilingUnitBrl: item.ceilingUnitBrl ?? null,
        priceItemId: item.priceItemId ?? null,
        order: item.order ?? index,
      })),
    });

    const baseData = {
      name: payload.name,
      mode: "LICITACAO" as const,
      markupPercentage: String(payload.markupPercentage ?? 0),
      usdToBrlRate: String(usdToBrlRate),
      internalCostTotal: String(bid.internalTotalBrl),
      clientPriceTotal: String(bid.bidTotalBrl),
      computedAt: new Date(),
      bidOrg: payload.bidOrg ?? null,
      bidNumber: payload.bidNumber ?? null,
      contractMonths: payload.contractMonths ?? 12,
      ceilingTotalBrl: payload.ceilingTotalBrl != null ? String(payload.ceilingTotalBrl) : null,
    };

    const simId = await prisma.$transaction(async (tx) => {
      const sim = simulationId
        ? await tx.forgeSimulation.update({ where: { id: simulationId, organizationId: orgId }, data: baseData })
        : await tx.forgeSimulation.create({ data: { organizationId: orgId, createdById: userId, ...baseData } });

      await tx.forgeBidItem.deleteMany({ where: { simulationId: sim.id } });

      // Dois passos por causa da self-relation parentId (2 níveis: item → subitens).
      const codeToId = new Map<string, string>();
      const parents = bid.items.filter((item) => !item.parentCode);
      for (const item of parents) {
        const created = await tx.forgeBidItem.create({
          data: {
            simulationId: sim.id,
            code: item.code,
            description: item.description,
            unit: item.unit,
            quantity: String(item.quantity),
            internalUnitCostBrl: String(item.internalUnitCostBrl),
            markupPercentage: String(item.markupPercentage),
            bidUnitBrl: String(item.bidUnitBrl),
            bidMonthlyBrl: String(item.bidMonthlyBrl),
            bidTotalBrl: String(item.bidTotalBrl),
            ceilingUnitBrl: item.ceilingUnitBrl != null ? String(item.ceilingUnitBrl) : null,
            exequibilidade: item.exequibilidade,
            priceItemId: item.priceItemId,
            order: item.order,
          },
        });
        codeToId.set(item.code, created.id);
      }
      const children = bid.items.filter((item) => item.parentCode);
      for (const item of children) {
        await tx.forgeBidItem.create({
          data: {
            simulationId: sim.id,
            parentId: item.parentCode ? codeToId.get(item.parentCode) ?? null : null,
            code: item.code,
            description: item.description,
            unit: item.unit,
            quantity: String(item.quantity),
            internalUnitCostBrl: String(item.internalUnitCostBrl),
            markupPercentage: String(item.markupPercentage),
            bidUnitBrl: String(item.bidUnitBrl),
            bidMonthlyBrl: String(item.bidMonthlyBrl),
            bidTotalBrl: String(item.bidTotalBrl),
            ceilingUnitBrl: item.ceilingUnitBrl != null ? String(item.ceilingUnitBrl) : null,
            exequibilidade: item.exequibilidade,
            priceItemId: item.priceItemId,
            order: item.order,
          },
        });
      }
      return sim.id;
    });

    return { id: simId, mode: "LICITACAO" as const, result: bid };
  }

  // Modo Comercial
  const { input: engineInput, aiModelCode } = await buildCommercialInput(payload, orgId, usdToBrlRate);
  const result = computeSimulation(engineInput);

  const baseData = {
    name: payload.name,
    mode: "COMERCIAL" as const,
    markupPercentage: String(payload.markupPercentage ?? 0),
    usdToBrlRate: String(usdToBrlRate),
    internalCostTotal: String(result.internalSubtotalBrl),
    clientPriceTotal: String(result.clientPriceBrl),
    computedAt: new Date(),
    userCount: payload.userCount ?? 1,
    aiPriceItemId: payload.aiPriceItemId ?? null,
    aiModelCode,
    inputTokensPerUser: payload.inputTokensPerUser ?? 0,
    outputTokensPerUser: payload.outputTokensPerUser ?? 0,
    cachedTokensPerUser: payload.cachedTokensPerUser ?? 0,
    whatsappEnabled: payload.whatsappEnabled ?? false,
    whatsappMix: (payload.whatsapp ?? []) as unknown as Prisma.InputJsonValue,
  };

  const simId = await prisma.$transaction(async (tx) => {
    const sim = simulationId
      ? await tx.forgeSimulation.update({ where: { id: simulationId, organizationId: orgId }, data: baseData })
      : await tx.forgeSimulation.create({ data: { organizationId: orgId, createdById: userId, ...baseData } });

    await tx.forgeSimulationLineItem.deleteMany({ where: { simulationId: sim.id } });
    if (result.lines.length) {
      await tx.forgeSimulationLineItem.createMany({
        data: result.lines.map((line, index) => ({
          simulationId: sim.id,
          priceItemId: line.priceItemId,
          category: line.category,
          label: line.label,
          quantity: String(line.quantity),
          unit: line.unit,
          unitCostBrl: String(line.unitCostBrl),
          internalCost: String(line.internalCostBrl),
          meta: line.meta as Prisma.InputJsonValue,
          order: index,
        })),
      });
    }
    return sim.id;
  });

  return { id: simId, mode: "COMERCIAL" as const, result };
}

export const createForgeSimulation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "POST", summary: "Create forge simulation", tags: ["Forge"] })
  .input(createSimulationSchema)
  .output(z.object({ id: z.string(), mode: z.string(), result: z.any() }))
  .handler(async ({ input, context, errors }) => {
    try {
      return await persistSimulation(input, context.org.id, context.user.id);
    } catch (err) {
      console.error("[forge/simulations create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgeSimulation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "PATCH", summary: "Update forge simulation", tags: ["Forge"] })
  .input(updateSimulationSchema)
  .output(z.object({ id: z.string(), mode: z.string(), result: z.any() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, ...rest } = input;
      const payload = createSimulationSchema.parse(rest);
      return await persistSimulation(payload, context.org.id, context.user.id, id);
    } catch (err) {
      console.error("[forge/simulations update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deleteForgeSimulation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "DELETE", summary: "Delete forge simulation", tags: ["Forge"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.forgeSimulation.delete({ where: { id: input.id, organizationId: context.org.id } });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const convertSimulationToProposal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireSystemAdminMiddleware)
  .route({ method: "POST", summary: "Convert simulation to proposal", tags: ["Forge"] })
  .input(
    z.object({
      simulationId: z.string(),
      breakdown: z
        .object({
          recurring: z.array(z.object({ label: z.string(), monthly: z.number() })).default([]),
          oneTime: z.array(z.object({ label: z.string(), amount: z.number() })).default([]),
          termMonths: z.number().int().default(12),
          validityLabel: z.string().default(""),
        })
        .optional(),
    }),
  )
  .output(z.object({ proposalId: z.string(), number: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const simulation = await prisma.forgeSimulation.findFirst({
      where: { id: input.simulationId, organizationId: context.org.id },
      include: { bidItems: true },
    });
    if (!simulation) throw errors.NOT_FOUND;

    try {
      const orgId = context.org.id;
      const userId = context.user.id;

      // Linhas ofertadas ao cliente — nunca custo interno/markup.
      const round2 = (value: number) => Math.round(value * 100) / 100;
      const parentIds = new Set(
        simulation.bidItems.map((item) => item.parentId).filter((id): id is string => Boolean(id)),
      );

      type ProposalLine = { sku: string; name: string; quantity: string; unitValue: string; order: number };
      let proposalLines: ProposalLine[] = [];
      let headerConfig: Record<string, unknown> = {};

      if (simulation.mode === "LICITACAO") {
        proposalLines = simulation.bidItems
          .filter((item) => !parentIds.has(item.id))
          .map((item) => ({
            sku: `BID-${simulation.id}-${item.code}`,
            name: `${item.code} — ${item.description}`,
            quantity: item.quantity.toString(),
            unitValue: item.bidUnitBrl.toString(),
            order: item.order,
          }));
      } else if (input.breakdown) {
        // Comercial com seções: recorrente (qtd = meses da vigência) + único.
        const recurring = input.breakdown.recurring.filter((line) => line.monthly > 0);
        const oneTime = input.breakdown.oneTime.filter((line) => line.amount > 0);
        const termMonths = input.breakdown.termMonths;
        proposalLines = [
          ...recurring.map((line, index) => ({
            sku: `REC-${simulation.id}-${index}`,
            name: line.label,
            quantity: String(termMonths),
            unitValue: line.monthly.toString(),
            order: index,
          })),
          ...oneTime.map((line, index) => ({
            sku: `ONE-${simulation.id}-${index}`,
            name: line.label,
            quantity: "1",
            unitValue: line.amount.toString(),
            order: recurring.length + index,
          })),
        ];
        const monthlyTotal = round2(recurring.reduce((total, line) => total + line.monthly, 0));
        const oneTimeTotal = round2(oneTime.reduce((total, line) => total + line.amount, 0));
        headerConfig = {
          simulationBreakdown: {
            recurring,
            oneTime,
            termMonths,
            validityLabel: input.breakdown.validityLabel,
            monthlyTotal,
            oneTimeTotal,
            contractTotal: round2(monthlyTotal * termMonths + oneTimeTotal),
          },
        };
      } else {
        proposalLines = [
          {
            sku: `SIM-${simulation.id}`,
            name: simulation.name,
            quantity: "1",
            unitValue: simulation.clientPriceTotal.toString(),
            order: 0,
          },
        ];
      }

      const result = await prisma.$transaction(async (tx) => {
        const productIdBySku = new Map<string, string>();
        for (const line of proposalLines) {
          const product = await tx.forgeProduct.upsert({
            where: { organizationId_sku: { organizationId: orgId, sku: line.sku } },
            update: { value: line.unitValue, name: line.name },
            create: {
              organizationId: orgId,
              name: line.name,
              sku: line.sku,
              value: line.unitValue,
              createdById: userId,
            },
          });
          productIdBySku.set(line.sku, product.id);
        }

        const last = await tx.forgeProposal.findFirst({
          where: { organizationId: orgId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        const proposal = await tx.forgeProposal.create({
          data: {
            organizationId: orgId,
            title: simulation.name,
            number,
            responsibleId: userId,
            participants: [],
            createdById: userId,
            headerConfig: headerConfig as Prisma.InputJsonValue,
            products: {
              create: proposalLines.map((line) => ({
                productId: productIdBySku.get(line.sku)!,
                quantity: line.quantity,
                unitValue: line.unitValue,
                order: line.order,
              })),
            },
          },
          select: { id: true, number: true },
        });

        await tx.forgeSimulation.update({
          where: { id: simulation.id },
          data: { proposalId: proposal.id },
        });

        return proposal;
      });

      return { proposalId: result.id, number: result.number };
    } catch (err) {
      console.error("[forge/simulations convert]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
