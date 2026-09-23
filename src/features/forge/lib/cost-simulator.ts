// Motor puro do Simulador de Custos do Forge. Sem DB e sem I/O: as mesmas
// funções rodam no cliente (preview ao vivo) e no servidor (cálculo
// autoritativo). Preços de token vêm em USD/1k; o restante já em BRL ou USD,
// convertido pelo câmbio recebido.

import { toBrl } from "@/features/ia/lib/token-pricing";

export const WHATSAPP_CATEGORIES = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
  "SERVICE",
] as const;
export type WhatsappCategory = (typeof WHATSAPP_CATEGORIES)[number];

export type PriceCurrency = "BRL" | "USD";

export type PriceCategory =
  | "AI_MODEL"
  | "WHATSAPP_CONVERSATION"
  | "INFRA_SERVER"
  | "HOSTING"
  | "STORAGE"
  | "DATABASE"
  | "LABOR"
  | "OTHER";

export type PriceUnit =
  | "PER_1K_TOKENS"
  | "PER_CONVERSATION"
  | "PER_MONTH"
  | "PER_HOUR"
  | "PER_GB_MONTH"
  | "PER_COMPUTE_HOUR"
  | "FLAT";

export type ExequibilidadeFlag = "OK" | "EXCESSIVO" | "INEXEQUIVEL";

const round2 = (value: number): number => Math.round(value * 100) / 100;

const toCostBrl = (value: number, currency: PriceCurrency, rate: number): number =>
  currency === "USD" ? toBrl(value, rate) : value;

// ── Modo Comercial ──────────────────────────────────────────────

export interface SimulatorAiInput {
  modelCode: string;
  inputPer1kUsd: number;
  outputPer1kUsd: number;
  cachedInputPer1kUsd?: number;
  inputTokensPerUser: number;
  outputTokensPerUser: number;
  cachedTokensPerUser?: number;
}

export interface SimulatorWhatsappLine {
  category: WhatsappCategory;
  pricePerConversation: number;
  currency: PriceCurrency;
  conversationsPerUser: number;
}

export interface SimulatorOperationalLine {
  priceItemId: string;
  category: PriceCategory;
  label: string;
  unit: PriceUnit;
  unitPrice: number;
  currency: PriceCurrency;
  quantity: number;
}

export interface CostSimulatorInput {
  userCount: number;
  ai: SimulatorAiInput | null;
  whatsapp: SimulatorWhatsappLine[];
  operational: SimulatorOperationalLine[];
  markupPercentage: number;
  usdToBrlRate: number;
}

export interface CostLineBreakdown {
  priceItemId: string | null;
  category: PriceCategory;
  label: string;
  quantity: number;
  unit: PriceUnit;
  unitCostBrl: number;
  internalCostBrl: number;
  meta: Record<string, unknown>;
}

export interface CostSimulatorResult {
  lines: CostLineBreakdown[];
  internalSubtotalBrl: number;
  markupPercentage: number;
  marginAmountBrl: number;
  clientPriceBrl: number;
  perUserClientPriceBrl: number;
}

export function computeSimulation(input: CostSimulatorInput): CostSimulatorResult {
  const userCount = Math.max(input.userCount, 0);
  const lines: CostLineBreakdown[] = [];

  if (input.ai) {
    const ai = input.ai;
    const totalInputTokens = userCount * ai.inputTokensPerUser;
    const totalOutputTokens = userCount * ai.outputTokensPerUser;
    const totalCachedTokens = userCount * (ai.cachedTokensPerUser ?? 0);
    const billedInputTokens = Math.max(totalInputTokens - totalCachedTokens, 0);
    const cachedRate = ai.cachedInputPer1kUsd ?? ai.inputPer1kUsd;

    const usd =
      (billedInputTokens / 1000) * ai.inputPer1kUsd +
      (totalCachedTokens / 1000) * cachedRate +
      (totalOutputTokens / 1000) * ai.outputPer1kUsd;
    const internalCostBrl = round2(toBrl(usd, input.usdToBrlRate));

    lines.push({
      priceItemId: null,
      category: "AI_MODEL",
      label: `IA — ${ai.modelCode}`,
      quantity: userCount,
      unit: "PER_1K_TOKENS",
      unitCostBrl: userCount > 0 ? internalCostBrl / userCount : 0,
      internalCostBrl,
      meta: {
        modelCode: ai.modelCode,
        totalInputTokens,
        totalOutputTokens,
        totalCachedTokens,
        usd,
      },
    });
  }

  for (const line of input.whatsapp) {
    const conversations = userCount * line.conversationsPerUser;
    const unitCostBrl = toCostBrl(line.pricePerConversation, line.currency, input.usdToBrlRate);
    const internalCostBrl = round2(conversations * unitCostBrl);
    lines.push({
      priceItemId: null,
      category: "WHATSAPP_CONVERSATION",
      label: `WhatsApp — ${line.category}`,
      quantity: conversations,
      unit: "PER_CONVERSATION",
      unitCostBrl,
      internalCostBrl,
      meta: { category: line.category, conversationsPerUser: line.conversationsPerUser },
    });
  }

  for (const line of input.operational) {
    const unitCostBrl = toCostBrl(line.unitPrice, line.currency, input.usdToBrlRate);
    const internalCostBrl = round2(line.quantity * unitCostBrl);
    lines.push({
      priceItemId: line.priceItemId,
      category: line.category,
      label: line.label,
      quantity: line.quantity,
      unit: line.unit,
      unitCostBrl,
      internalCostBrl,
      meta: {},
    });
  }

  const internalSubtotalBrl = round2(
    lines.reduce((total, line) => total + line.internalCostBrl, 0),
  );
  // Margem sobre o preço de venda (lucro ÷ preço): preço = custo ÷ (1 − margem%).
  const marginPct = Math.min(Math.max(input.markupPercentage, 0), 99);
  const clientPriceBrl =
    marginPct > 0 ? round2(internalSubtotalBrl / (1 - marginPct / 100)) : internalSubtotalBrl;
  const marginAmountBrl = round2(clientPriceBrl - internalSubtotalBrl);
  const perUserClientPriceBrl = userCount > 0 ? round2(clientPriceBrl / userCount) : clientPriceBrl;

  return {
    lines,
    internalSubtotalBrl,
    markupPercentage: input.markupPercentage,
    marginAmountBrl,
    clientPriceBrl,
    perUserClientPriceBrl,
  };
}

// ── Modo Licitação ──────────────────────────────────────────────

export interface BidItemInput {
  code: string;
  parentCode?: string | null;
  description: string;
  unit: string;
  quantity: number;
  internalUnitCostBrl: number;
  markupPercentage?: number | null;
  ceilingUnitBrl?: number | null;
  priceItemId?: string | null;
  order?: number;
}

export interface BidSimulatorInput {
  contractMonths: number;
  markupPercentage: number;
  ceilingTotalBrl?: number | null;
  items: BidItemInput[];
}

export interface BidItemResult {
  code: string;
  parentCode: string | null;
  description: string;
  unit: string;
  quantity: number;
  internalUnitCostBrl: number;
  markupPercentage: number;
  isParent: boolean;
  bidUnitBrl: number;
  bidMonthlyBrl: number;
  bidTotalBrl: number;
  ceilingUnitBrl: number | null;
  exequibilidade: ExequibilidadeFlag;
  priceItemId: string | null;
  order: number;
}

export interface BidSimulatorResult {
  items: BidItemResult[];
  internalTotalBrl: number;
  bidTotalBrl: number;
  bidMonthlyTotalBrl: number;
  marginAmountBrl: number;
  ceilingTotalBrl: number | null;
  withinCeiling: boolean;
  flags: ExequibilidadeFlag[];
}

export function computeBid(input: BidSimulatorInput): BidSimulatorResult {
  const months = Math.max(input.contractMonths, 1);
  const parentCodes = new Set(
    input.items.map((item) => item.parentCode).filter((code): code is string => Boolean(code)),
  );

  // Passo 1 — calcula cada item pelas suas próprias entradas (matemática de folha).
  const computed = new Map<string, BidItemResult>();
  input.items.forEach((item, index) => {
    const marginInput = item.markupPercentage ?? input.markupPercentage;
    const marginPct = Math.min(Math.max(marginInput, 0), 99);
    // Margem sobre o preço: preço = custo ÷ (1 − margem%).
    const bidUnitBrl = round2(
      marginPct > 0 ? item.internalUnitCostBrl / (1 - marginPct / 100) : item.internalUnitCostBrl,
    );
    const bidTotalBrl = round2(item.quantity * bidUnitBrl);
    const bidMonthlyBrl = round2(bidTotalBrl / months);
    const ceilingUnitBrl = item.ceilingUnitBrl ?? null;

    let exequibilidade: ExequibilidadeFlag = "OK";
    if (bidUnitBrl < item.internalUnitCostBrl) exequibilidade = "INEXEQUIVEL";
    else if (ceilingUnitBrl !== null && bidUnitBrl > ceilingUnitBrl) exequibilidade = "EXCESSIVO";

    computed.set(item.code, {
      code: item.code,
      parentCode: item.parentCode ?? null,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      internalUnitCostBrl: item.internalUnitCostBrl,
      markupPercentage: marginInput,
      isParent: parentCodes.has(item.code),
      bidUnitBrl,
      bidMonthlyBrl,
      bidTotalBrl,
      ceilingUnitBrl,
      exequibilidade,
      priceItemId: item.priceItemId ?? null,
      order: item.order ?? index,
    });
  });

  // Passo 2 — itens-pai passam a refletir a soma dos seus filhos (linha "Conjunto").
  for (const result of computed.values()) {
    if (!result.isParent) continue;
    const children = [...computed.values()].filter((child) => child.parentCode === result.code);
    const childrenTotal = round2(children.reduce((total, child) => total + child.bidTotalBrl, 0));
    const childrenInternal = round2(
      children.reduce((total, child) => total + child.internalUnitCostBrl * child.quantity, 0),
    );
    result.bidTotalBrl = childrenTotal;
    result.bidUnitBrl = childrenTotal;
    result.bidMonthlyBrl = round2(childrenTotal / months);
    result.internalUnitCostBrl = childrenInternal;
    result.exequibilidade =
      children.find((child) => child.exequibilidade === "INEXEQUIVEL")?.exequibilidade ??
      children.find((child) => child.exequibilidade === "EXCESSIVO")?.exequibilidade ??
      "OK";
  }

  // Passo 3 — totais gerais somam apenas folhas, para não duplicar o item-pai.
  const leaves = [...computed.values()].filter((item) => !item.isParent);
  const internalTotalBrl = round2(
    leaves.reduce((total, leaf) => total + leaf.internalUnitCostBrl * leaf.quantity, 0),
  );
  const bidTotalBrl = round2(leaves.reduce((total, leaf) => total + leaf.bidTotalBrl, 0));
  const bidMonthlyTotalBrl = round2(bidTotalBrl / months);
  const marginAmountBrl = round2(bidTotalBrl - internalTotalBrl);
  const ceilingTotalBrl = input.ceilingTotalBrl ?? null;
  const withinCeiling = ceilingTotalBrl === null || bidTotalBrl <= ceilingTotalBrl;

  const flags = new Set<ExequibilidadeFlag>();
  for (const leaf of leaves) if (leaf.exequibilidade !== "OK") flags.add(leaf.exequibilidade);
  if (!withinCeiling) flags.add("EXCESSIVO");

  return {
    items: [...computed.values()].sort((left, right) => left.order - right.order),
    internalTotalBrl,
    bidTotalBrl,
    bidMonthlyTotalBrl,
    marginAmountBrl,
    ceilingTotalBrl,
    withinCeiling,
    flags: [...flags],
  };
}
