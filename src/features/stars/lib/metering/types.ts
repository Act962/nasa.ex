// Tipos do catálogo único de preço de Stars (spec 0020).

/** Unidade de cobrança. `call` = custo fixo por evento. */
export type MeterUnit =
  | "call"
  | "token"
  | "mb"
  | "second"
  | "minute"
  | "image"
  | "message";

/**
 * Como o preço da variante se combina com o preço-base:
 * `absolute` substitui, `multiplier` multiplica.
 */
export type VariantMode = "absolute" | "multiplier";

/** De onde veio o preço aplicado. Registrado para auditoria. */
export type PriceSource = "override" | "catalog" | "default" | "missing";

/** Por que uma cobrança não aconteceu. */
export type SkipReason =
  | "no_price"
  | "disabled"
  | "zero_cost"
  | "invalid_quantity"
  | "quantity_missing";

export interface PriceEntry {
  action: string;
  source: PriceSource;
  /** Custo fixo em ★ quando `unit` é `call`; preço-base das variantes nos demais casos. */
  baseCost: number;
  unit: MeterUnit;
  unitCost: number | null;
  unitDivisor: number;
  minCharge: number;
  maxCharge: number | null;
  variantCosts: Record<string, number> | null;
  variantMode: VariantMode;
  allowBonus: boolean;
  isEnabled: boolean;
  displayName: string | null;
}

export interface MeterQuantity {
  unit: MeterUnit;
  amount: number;
}

export interface ComputedCharge {
  stars: number;
  /** Teto máximo limitou o valor. Sinal de bug de contagem no chamador. */
  cappedByMax: boolean;
  /** Variante informada não existe no catálogo; aplicou-se o preço-base. */
  unknownVariant: boolean;
  skipReason: SkipReason | null;
}

/** Valores padrão de uma linha de catálogo, usados quando o campo vem nulo do banco. */
export const PRICE_ENTRY_FALLBACK = {
  unit: "call" as MeterUnit,
  unitDivisor: 1,
  minCharge: 0,
  variantMode: "absolute" as VariantMode,
  allowBonus: true,
  isEnabled: true,
} as const;
