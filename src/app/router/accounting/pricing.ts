import { z } from "zod";
import prisma from "@/lib/prisma";
import { loadEffectiveRateContext } from "@/features/accounting/server/pricing/effective-rate-context";
import { loadPricingDiagnostics } from "@/features/accounting/server/pricing/load-pricing-diagnostics";
import { accountingReadProcedure, accountingWriteProcedure } from "./procedures";

// Produtos, classificação tributária e precificação (spec 0051, item 7).

const productTaxKindSchema = z.enum(["PRODUCT", "SERVICE"]);
const optionalCode = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value === null || value === undefined || pattern.test(value), message);

const classificationInputShape = z.object({
  name: z.string().trim().min(1, "Dê um nome à classificação").max(120),
  kind: productTaxKindSchema,
  ncm: optionalCode(/^\d{8}$/, "NCM tem 8 dígitos"),
  nbs: optionalCode(/^[\d.]{4,15}$/, "NBS inválido"),
  lc116Item: optionalCode(/^\d{1,2}\.\d{2}$/, "Item da LC 116 no formato 1.03"),
  cClassTrib: optionalCode(/^\d{6}$/, "cClassTrib tem 6 dígitos"),
  cst: optionalCode(/^\d{3}$/, "CST tem 3 dígitos"),
  reductionBps: z.union([z.literal(0), z.literal(3000), z.literal(6000), z.literal(10000)]).default(0),
  issMunicipioIbge: optionalCode(/^\d{7}$/, "Código IBGE do município tem 7 dígitos"),
  issRateBps: z.number().int().min(0).max(1000).nullable().optional(),
});

const classificationShape = z.object({
  id: z.string(),
  name: z.string(),
  kind: productTaxKindSchema,
  ncm: z.string().nullable(),
  nbs: z.string().nullable(),
  lc116Item: z.string().nullable(),
  cClassTrib: z.string().nullable(),
  cst: z.string().nullable(),
  reductionBps: z.number(),
  issMunicipioIbge: z.string().nullable(),
  issRateBps: z.number().nullable(),
  productCount: z.number(),
});

const calculationStepShape = z.object({
  label: z.string(),
  formula: z.string().optional(),
  value: z.string(),
  legalSource: z.string().optional(),
  termId: z.string().optional(),
});

const listClassifications = accountingReadProcedure
  .route({ method: "GET", summary: "Classificações tributárias de produtos", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(z.object({ classifications: z.array(classificationShape) }))
  .handler(async ({ context }) => {
    const classifications = await prisma.productTaxClassification.findMany({
      where: { organizationId: context.org.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { forgeProducts: true } } },
    });
    return {
      classifications: classifications.map(({ _count, ...classification }) => ({
        id: classification.id,
        name: classification.name,
        kind: classification.kind,
        ncm: classification.ncm,
        nbs: classification.nbs,
        lc116Item: classification.lc116Item,
        cClassTrib: classification.cClassTrib,
        cst: classification.cst,
        reductionBps: classification.reductionBps,
        issMunicipioIbge: classification.issMunicipioIbge,
        issRateBps: classification.issRateBps,
        productCount: _count.forgeProducts,
      })),
    };
  });

const createClassification = accountingWriteProcedure
  .route({ method: "POST", summary: "Cria classificação tributária", tags: ["Accounting"] })
  .input(classificationInputShape)
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const created = await prisma.productTaxClassification.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        kind: input.kind,
        ncm: input.ncm ?? null,
        nbs: input.nbs ?? null,
        lc116Item: input.lc116Item ?? null,
        cClassTrib: input.cClassTrib ?? null,
        cst: input.cst ?? null,
        reductionBps: input.reductionBps,
        issMunicipioIbge: input.issMunicipioIbge ?? null,
        issRateBps: input.issRateBps ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  });

const updateClassification = accountingWriteProcedure
  .route({ method: "PUT", summary: "Atualiza classificação tributária", tags: ["Accounting"] })
  .input(classificationInputShape.extend({ id: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const updated = await prisma.productTaxClassification.updateMany({
      where: { id: input.id, organizationId: context.org.id },
      data: {
        name: input.name,
        kind: input.kind,
        ncm: input.ncm ?? null,
        nbs: input.nbs ?? null,
        lc116Item: input.lc116Item ?? null,
        cClassTrib: input.cClassTrib ?? null,
        cst: input.cst ?? null,
        reductionBps: input.reductionBps,
        issMunicipioIbge: input.issMunicipioIbge ?? null,
        issRateBps: input.issRateBps ?? null,
      },
    });
    if (updated.count === 0) throw errors.NOT_FOUND({ message: "Classificação não encontrada" });
    return { ok: true as const };
  });

const deleteClassification = accountingWriteProcedure
  .route({ method: "DELETE", summary: "Remove classificação tributária", tags: ["Accounting"] })
  .input(z.object({ id: z.string().min(1) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    // Produtos vinculados voltam a "sem classificação" (onDelete: SetNull).
    const deleted = await prisma.productTaxClassification.deleteMany({
      where: { id: input.id, organizationId: context.org.id },
    });
    if (deleted.count === 0) throw errors.NOT_FOUND({ message: "Classificação não encontrada" });
    return { ok: true as const };
  });

const assignClassificationToProduct = accountingWriteProcedure
  .route({ method: "PUT", summary: "Atribui classificação a um produto do Forge", tags: ["Accounting"] })
  .input(z.object({ productId: z.string().min(1), classificationId: z.string().min(1).nullable() }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    if (input.classificationId) {
      const classification = await prisma.productTaxClassification.findFirst({
        where: { id: input.classificationId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!classification) throw errors.NOT_FOUND({ message: "Classificação não encontrada" });
    }
    const updated = await prisma.forgeProduct.updateMany({
      where: { id: input.productId, organizationId: context.org.id },
      data: { taxClassificationId: input.classificationId },
    });
    if (updated.count === 0) throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    return { ok: true as const };
  });

const getEffectiveRate = accountingReadProcedure
  .route({ method: "GET", summary: "Alíquota efetiva do perfil fiscal para precificar", tags: ["Accounting"] })
  .input(
    z.object({
      kind: productTaxKindSchema,
      reductionBps: z.number().int().min(0).max(10000).optional(),
      issRateBpsOverride: z.number().int().min(0).max(1000).nullable().optional(),
    }),
  )
  .output(
    z.object({
      regime: z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]),
      rbt12Cents: z.number(),
      isRbt12Proportional: z.boolean(),
      rateBps: z.number(),
      components: z.array(z.object({ label: z.string(), rateBps: z.number() })),
      steps: z.array(calculationStepShape),
      warnings: z.array(z.object({ code: z.string(), message: z.string() })),
      sources: z.array(z.string()),
      comparison: z.array(z.object({ year: z.number(), rateBps: z.number(), isEstimated: z.boolean() })),
    }),
  )
  .handler(async ({ input, context }) => {
    const rateContext = await loadEffectiveRateContext(context.org.id);
    return {
      regime: rateContext.regime,
      rbt12Cents: rateContext.rbt12Cents,
      isRbt12Proportional: rateContext.isRbt12Proportional,
      ...rateContext.computeWithComparison(input),
    };
  });

const getPricingDiagnostics = accountingReadProcedure
  .route({ method: "GET", summary: "Diagnóstico de preços, propostas e cursos", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      regime: z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]),
      serviceRateBps: z.number(),
      productRateBps: z.number(),
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          sku: z.string(),
          unit: z.string(),
          priceCents: z.number(),
          classificationId: z.string().nullable(),
          classificationName: z.string().nullable(),
          kind: productTaxKindSchema,
          rateBps: z.number(),
          taxPerUnitCents: z.number(),
          netCents: z.number(),
          alerts: z.array(z.string()),
        }),
      ),
      proposals: z.array(
        z.object({
          id: z.string(),
          number: z.number(),
          title: z.string(),
          status: z.string(),
          createdAt: z.date(),
          totalCents: z.number(),
          hasTaxBreakdown: z.boolean(),
          hasTaxLine: z.boolean(),
          usedRateBps: z.number().nullable(),
          effectiveRateBps: z.number(),
          isMissingTax: z.boolean(),
          isRateDifferent: z.boolean(),
        }),
      ),
      courses: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          isPublished: z.boolean(),
          priceCents: z.number(),
          estimatedTaxCents: z.number(),
          netCents: z.number(),
        }),
      ),
      trafegoPlans: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          adBudgetCents: z.number(),
          serviceFeeCents: z.number(),
          estimatedTaxCents: z.number(),
          netCents: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => loadPricingDiagnostics({ organizationId: context.org.id, userId: context.user.id }));

const applySuggestedPrice = accountingWriteProcedure
  .route({ method: "PUT", summary: "Aplica o preço sugerido a um produto do Forge", tags: ["Accounting"] })
  .input(z.object({ productId: z.string().min(1), priceCents: z.number().int().min(1).max(100_000_000_000) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const updated = await prisma.forgeProduct.updateMany({
      where: { id: input.productId, organizationId: context.org.id },
      data: { value: (input.priceCents / 100).toFixed(2) },
    });
    if (updated.count === 0) throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    return { ok: true as const };
  });

export const accountingPricingRouter = {
  classifications: {
    list: listClassifications,
    create: createClassification,
    update: updateClassification,
    delete: deleteClassification,
  },
  assignToProduct: assignClassificationToProduct,
  effectiveRate: getEffectiveRate,
  diagnostics: getPricingDiagnostics,
  applyPrice: applySuggestedPrice,
};
