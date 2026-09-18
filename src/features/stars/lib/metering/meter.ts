/**
 * Ponto único de cobrança de Stars (spec 0020).
 *
 * Tudo que cobra ★ passa por aqui: resolve o preço no catálogo, calcula o valor
 * e debita. A resolução e o cálculo não fazem I/O de rede nem rodam dentro da
 * transação de débito — a transação é responsabilidade exclusiva de `debitStars`
 * (Regra 18 do CLAUDE.md).
 */

import { StarTransactionType } from "@/generated/prisma/client";
import { debitStars } from "../star-service";
import { computeStars } from "./compute-stars";
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

/** Ações cobradas sem preço desde que o processo subiu, com a contagem de vezes. */
export function getCatalogMisses(): Array<{ action: string; count: number }> {
  return [...reportedMisses.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((left, right) => right.count - left.count);
}

export async function meter(input: MeterInput): Promise<MeterResult> {
  const entry = await resolvePrice(input.organizationId, input.action);
  const charge = computeStars(entry, input.quantity, input.variant);

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
    allowBonus ? undefined : { allowBonus: false },
  );

  return {
    charged: true,
    success: result.success,
    cost: charge.stars,
    newBalance: result.newBalance,
    newBonusBalance: result.newBonusBalance,
    priceSource: entry.source,
  };
}
