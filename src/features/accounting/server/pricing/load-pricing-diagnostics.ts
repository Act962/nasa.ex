import "server-only";

import prisma from "@/lib/prisma";
import { applyBps } from "@/features/accounting/lib/format";
import { loadEffectiveRateContext } from "./effective-rate-context";

// Diagnóstico de preços (spec 0051, item 7): quanto de cada preço vira imposto
// e quais propostas saíram sem imposto ou com alíquota diferente da efetiva.

const RATE_DIFFERENCE_TOLERANCE_BPS = 100;
const TAX_LINE_PATTERN = /^impostos?\b/i;
const TAX_LABEL_RATE_PATTERN = /impostos?\s*\(([\d.,]+)\s*%\)/i;

function decimalToCents(value: { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

interface BreakdownLine {
  label: string;
}

function readBreakdownLines(headerConfig: unknown): BreakdownLine[] {
  if (!headerConfig || typeof headerConfig !== "object") return [];
  const breakdown = (headerConfig as { simulationBreakdown?: unknown }).simulationBreakdown;
  if (!breakdown || typeof breakdown !== "object") return [];
  const { recurring, oneTime } = breakdown as { recurring?: unknown; oneTime?: unknown };
  return [recurring, oneTime]
    .flatMap((lines) => (Array.isArray(lines) ? lines : []))
    .filter((line): line is BreakdownLine => Boolean(line) && typeof (line as { label?: unknown }).label === "string");
}

function readTaxBreakdownRate(taxBreakdown: unknown): number | null {
  if (!taxBreakdown || typeof taxBreakdown !== "object") return null;
  const rateBps = (taxBreakdown as { rateBps?: unknown }).rateBps;
  return typeof rateBps === "number" && Number.isFinite(rateBps) ? rateBps : null;
}

function rateFromTaxLabel(label: string): number | null {
  const match = TAX_LABEL_RATE_PATTERN.exec(label);
  if (!match) return null;
  const percent = Number(match[1].replace(",", "."));
  return Number.isFinite(percent) ? Math.round(percent * 100) : null;
}

export async function loadPricingDiagnostics(params: { organizationId: string; userId: string }) {
  const { organizationId } = params;
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 12);

  const [rateContext, products, proposals, courses, viewer] = await Promise.all([
    loadEffectiveRateContext(organizationId),
    prisma.forgeProduct.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      take: 300,
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        value: true,
        taxClassification: {
          select: { id: true, name: true, kind: true, ncm: true, nbs: true, lc116Item: true, cClassTrib: true, reductionBps: true, issRateBps: true },
        },
      },
    }),
    prisma.forgeProposal.findMany({
      where: { organizationId, isTemplate: false, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        createdAt: true,
        headerConfig: true,
        taxBreakdown: true,
        products: { select: { quantity: true, unitValue: true } },
      },
    }),
    prisma.nasaRouteCourse.findMany({
      where: { creatorOrgId: organizationId, priceBrlCents: { gt: 0 } },
      select: { id: true, title: true, priceBrlCents: true, isPublished: true },
      take: 100,
    }),
    prisma.user.findUnique({ where: { id: params.userId }, select: { isSystemAdmin: true } }),
  ]);

  const serviceRateBps = rateContext.rateBpsFor({ kind: "SERVICE" });
  const productRateBps = rateContext.rateBpsFor({ kind: "PRODUCT" });

  const productRows = products.map((product) => {
    const classification = product.taxClassification;
    const kind = classification?.kind ?? "SERVICE";
    const rateBps = classification
      ? rateContext.rateBpsFor({
          kind,
          reductionBps: classification.reductionBps,
          issRateBpsOverride: classification.issRateBps,
        })
      : serviceRateBps;
    const priceCents = decimalToCents(product.value);
    const taxPerUnitCents = applyBps(priceCents, rateBps);
    const alerts: string[] = [];
    if (!classification) alerts.push("Sem classificação tributária (usando alíquota de serviço)");
    if (classification?.kind === "PRODUCT" && !classification.ncm) alerts.push("Produto sem NCM");
    if (classification?.kind === "SERVICE" && !classification.nbs && !classification.lc116Item) {
      alerts.push("Serviço sem NBS nem item da LC 116");
    }
    if (classification && !classification.cClassTrib) alerts.push("Sem cClassTrib (código novo das notas da Reforma)");
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      priceCents,
      classificationId: classification?.id ?? null,
      classificationName: classification?.name ?? null,
      kind,
      rateBps,
      taxPerUnitCents,
      netCents: priceCents - taxPerUnitCents,
      alerts,
    };
  });

  const proposalRows = proposals.map((proposal) => {
    const totalCents = proposal.products.reduce(
      (total, line) => total + Math.round(Number(line.quantity.toString()) * decimalToCents(line.unitValue)),
      0,
    );
    const taxLines = readBreakdownLines(proposal.headerConfig).filter((line) => TAX_LINE_PATTERN.test(line.label.trim()));
    const breakdownRateBps = readTaxBreakdownRate(proposal.taxBreakdown);
    const labelRateBps = taxLines.map((line) => rateFromTaxLabel(line.label)).find((rate) => rate !== null) ?? null;
    const usedRateBps = breakdownRateBps ?? labelRateBps;
    const hasTaxBreakdown = breakdownRateBps !== null;
    const hasTaxLine = taxLines.length > 0;
    const isMissingTax = !hasTaxBreakdown && !hasTaxLine;
    const isRateDifferent =
      usedRateBps !== null && Math.abs(usedRateBps - serviceRateBps) > RATE_DIFFERENCE_TOLERANCE_BPS;
    return {
      id: proposal.id,
      number: proposal.number,
      title: proposal.title,
      status: proposal.status,
      createdAt: proposal.createdAt,
      totalCents,
      hasTaxBreakdown,
      hasTaxLine,
      usedRateBps,
      effectiveRateBps: serviceRateBps,
      isMissingTax,
      isRateDifferent,
    };
  });

  const courseRows = courses.map((course) => {
    const taxCents = applyBps(course.priceBrlCents, serviceRateBps);
    return {
      id: course.id,
      title: course.title,
      isPublished: course.isPublished,
      priceCents: course.priceBrlCents,
      estimatedTaxCents: taxCents,
      netCents: course.priceBrlCents - taxCents,
    };
  });

  // Planos do trafeGO são da plataforma (sem organização): só quem administra o sistema vê.
  const trafegoPlans = viewer?.isSystemAdmin
    ? await prisma.trafegoPlan.findMany({
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, adBudgetBrlCents: true, serviceFeePercent: true, serviceFeeBrlCents: true },
      })
    : [];
  const trafegoRows = trafegoPlans.map((plan) => {
    const feePercentBps = Math.round(Number(plan.serviceFeePercent.toString()) * 100);
    const serviceFeeCents = plan.serviceFeeBrlCents ?? applyBps(plan.adBudgetBrlCents, feePercentBps);
    const taxCents = applyBps(serviceFeeCents, serviceRateBps);
    return {
      id: plan.id,
      name: plan.name,
      adBudgetCents: plan.adBudgetBrlCents,
      serviceFeeCents,
      estimatedTaxCents: taxCents,
      netCents: serviceFeeCents - taxCents,
    };
  });

  return {
    regime: rateContext.regime,
    serviceRateBps,
    productRateBps,
    products: productRows,
    proposals: proposalRows,
    courses: courseRows,
    trafegoPlans: trafegoRows,
  };
}
