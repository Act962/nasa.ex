/**
 * Ponto único de cobrança de Stars (spec 0020).
 *
 * Tudo que cobra ★ passa por aqui: resolve o preço no catálogo, calcula o valor
 * e debita. A resolução e o cálculo não fazem I/O de rede nem rodam dentro da
 * transação de débito — a transação é responsabilidade exclusiva de `debitStars`
 * (Regra 18 do CLAUDE.md).
 */

import {
  StarTransactionType,
  type UsageEventKind,
} from "@/generated/prisma/client";
import { debitStars } from "../star-service";
import { computeStars } from "./compute-stars";
import { recordUsageEvent, type TokenUsage } from "./record-usage-event";
import { resolvePrice } from "./resolve-price";
import type { MeterQuantity, PriceSource, SkipReason } from "./types";

export interface MeterInput {
  organizationId: string;
  /** Chave da ação no catálogo (ex.: `astro_prompt`). */
  action: string;
  userId?: string;
  /** Presente apenas em cobrança por quantidade. */
  quantity?: MeterQuantity;
  /** Modelo ou provider, quando o preço varia por ele. */
  variant?: string;
  appSlug?: string;
  description?: string;
  /** Proíbe usar saldo de bônus nesta cobrança. */
  disallowBonus?: boolean;
  transactionType?: StarTransactionType;

  /**
   * Custo externo deste evento. Quando presente, o registro de custo é gravado
   * após o commit do débito — nunca dentro da transação (Regra 18).
   */
  cost?: {
    kind: UsageEventKind;
    provider?: string;
    modelId?: string;
    usingCustomKey?: boolean;
    tokens?: TokenUsage;
    providerCostUsd?: number;
    infraCostUsd?: number;
    latencyMs?: number;
  };
  /**
   * Custo já calculado por uma fórmula do domínio, quando o preço não é um
   * número fixo e sim um modelo — caso do upload de vídeo, que depende de
   * tamanho, horizonte de hospedagem, margem, câmbio e preço da estrela.
   *
   * **Exceção, não atalho.** Use só quando o preço for genuinamente calculado;
   * constante no código é preço fixo e pertence ao catálogo. O `computedBy`
   * é obrigatório para que a origem fique auditável no log e no registro.
   *
   * O teto máximo do catálogo continua valendo como guarda.
   */
  computedStars?: { stars: number; computedBy: string };
  feature?: string;
  sessionId?: string;
  trackingId?: string;
  leadId?: string;
  metadata?: Record<string, unknown>;
}

export type MeterResult =
  | {
      charged: false;
      success: true;
      cost: 0;
      skipReason: SkipReason;
      priceSource: PriceSource;
    }
  | {
      charged: true;
      success: boolean;
      cost: number;
      newBalance: number;
      newBonusBalance: number;
      priceSource: PriceSource;
    };

/**
 * Ações já avisadas neste processo. Evita encher o log com a mesma linha a cada
 * cobrança, sem perder o sinal de que a ação existe e não tem preço.
 */
const reportedMisses = new Map<string, number>();

function reportMiss(action: string, skipReason: SkipReason) {
  const seen = reportedMisses.get(action) ?? 0;
  reportedMisses.set(action, seen + 1);
  if (seen > 0) return;
  console.warn(
    `[stars] ação "${action}" foi cobrada mas não tem preço aplicável (${skipReason}). ` +
      "Cadastre em /admin/stars > Regras. Ver docs/BILLING_ARCHITECTURE.md §2.3.",
  );
}

/**
 * Aplica um custo já calculado pelo domínio, mantendo o teto do catálogo como
 * guarda. Preço calculado não dispensa proteção contra erro de cálculo.
 */
function applyComputedStars(
  entry: Awaited<ReturnType<typeof resolvePrice>>,
  stars: number,
): ReturnType<typeof computeStars> {
  if (!Number.isFinite(stars) || stars <= 0) {
    return {
      stars: 0,
      cappedByMax: false,
      unknownVariant: false,
      skipReason: "invalid_quantity",
    };
  }
  const capped =
    entry.maxCharge !== null && stars > entry.maxCharge ? entry.maxCharge : stars;
  return {
    stars: Math.ceil(capped),
    cappedByMax: capped !== stars,
    unknownVariant: false,
    skipReason: null,
  };
}

/** Ações cobradas sem preço desde que o processo subiu, com a contagem de vezes. */
export function getCatalogMisses(): Array<{ action: string; count: number }> {
  return [...reportedMisses.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((left, right) => right.count - left.count);
}

export async function meter(input: MeterInput): Promise<MeterResult> {
  const entry = await resolvePrice(input.organizationId, input.action);
  const charge = input.computedStars
    ? applyComputedStars(entry, input.computedStars.stars)
    : computeStars(entry, input.quantity, input.variant);

  if (charge.unknownVariant) {
    console.warn(
      `[stars] variante "${input.variant}" não existe no catálogo de "${input.action}". ` +
        "Aplicado o preço-base.",
    );
  }

  if (charge.cappedByMax) {
    console.warn(
      `[stars] cobrança de "${input.action}" atingiu o teto máximo. ` +
        "Provável erro de contagem no chamador.",
    );
  }

  if (charge.skipReason) {
    // Zero explícito é decisão do admin, não esquecimento — não vira aviso.
    if (charge.skipReason !== "zero_cost" && charge.skipReason !== "disabled") {
      reportMiss(input.action, charge.skipReason);
    }
    // Evento gratuito ainda custou dinheiro no fornecedor: registrar é o que
    // permite enxergar prejuízo (D-4 da spec 0021).
    if (input.cost) {
      await recordUsageEvent({
        organizationId: input.organizationId,
        userId: input.userId,
        kind: input.cost.kind,
        action: input.action,
        appSlug: input.appSlug,
        feature: input.feature,
        provider: input.cost.provider,
        modelId: input.cost.modelId,
        usingCustomKey: input.cost.usingCustomKey,
        tokens: input.cost.tokens,
        quantity: input.quantity?.amount,
        quantityUnit: input.quantity?.unit,
        providerCostUsd: input.cost.providerCostUsd,
        infraCostUsd: input.cost.infraCostUsd,
        latencyMs: input.cost.latencyMs,
        starsCharged: 0,
        sessionId: input.sessionId,
        trackingId: input.trackingId,
        leadId: input.leadId,
        status: charge.skipReason === "no_price" ? "catalog_miss" : "ok",
        metadata: input.metadata,
      });
    }

    return {
      charged: false,
      success: true,
      cost: 0,
      skipReason: charge.skipReason,
      priceSource: entry.source,
    };
  }

  const appSlug =
    input.appSlug ?? input.action.split("_")[0] ?? input.action;
  const description =
    input.description ?? entry.displayName ?? input.action;
  const allowBonus = entry.allowBonus && !input.disallowBonus;

  const result = await debitStars(
    input.organizationId,
    charge.stars,
    input.transactionType ?? StarTransactionType.APP_CHARGE,
    description,
    appSlug,
    input.userId,
    { action: input.action, ...(allowBonus ? {} : { allowBonus: false }) },
  );

  // Fora da transação, best-effort: falhar aqui não invalida a cobrança.
  if (input.cost) {
    await recordUsageEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.cost.kind,
      action: input.action,
      appSlug,
      feature: input.feature,
      provider: input.cost.provider,
      modelId: input.cost.modelId,
      usingCustomKey: input.cost.usingCustomKey,
      tokens: input.cost.tokens,
      quantity: input.quantity?.amount,
      quantityUnit: input.quantity?.unit,
      providerCostUsd: input.cost.providerCostUsd,
      infraCostUsd: input.cost.infraCostUsd,
      latencyMs: input.cost.latencyMs,
      starsCharged: result.success ? charge.stars : 0,
      starTransactionId: result.starTransactionId,
      sessionId: input.sessionId,
      trackingId: input.trackingId,
      leadId: input.leadId,
      status: result.success ? "ok" : "insufficient_stars",
      metadata: input.metadata,
    });
  }

  return {
    charged: true,
    success: result.success,
    cost: charge.stars,
    newBalance: result.newBalance,
    newBonusBalance: result.newBonusBalance,
    priceSource: entry.source,
  };
}
