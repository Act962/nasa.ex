/**
 * Câmbio USD→BRL vigente, lido de `RouterPaymentSettings`.
 *
 * Mora no banco porque é o único número da precificação que varia de verdade e
 * que o financeiro precisa ajustar sem deploy. Cada evento de custo grava a taxa
 * que usou, então mudar o câmbio nunca reescreve o passado.
 */

import { FALLBACK_USD_TO_BRL } from "@/features/ia/lib/token-pricing";
import prisma from "@/lib/prisma";

const TTL = 5 * 60 * 1000;

let cached: { rate: number; starPriceBrl: number; loadedAt: number } | null =
  null;

export interface MonetarySettings {
  usdToBrlRate: number;
  starPriceBrl: number;
}

export async function getMonetarySettings(): Promise<MonetarySettings> {
  if (cached && Date.now() - cached.loadedAt < TTL) {
    return { usdToBrlRate: cached.rate, starPriceBrl: cached.starPriceBrl };
  }

  const settings = await prisma.routerPaymentSettings.findFirst({
    select: { usdToBrlRate: true, starPriceBrl: true },
  });

  const rate = settings ? Number(settings.usdToBrlRate) : FALLBACK_USD_TO_BRL;
  const starPriceBrl = settings ? Number(settings.starPriceBrl) : 0.15;

  cached = { rate, starPriceBrl, loadedAt: Date.now() };
  return { usdToBrlRate: rate, starPriceBrl };
}

export function invalidateMonetarySettings() {
  cached = null;
}
