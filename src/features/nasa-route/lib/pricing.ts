import "server-only";
import prisma from "@/lib/prisma";

/**
 * Cotação do STAR em BRL — pra checkout público de curso (Stripe BRL → STARS).
 *
 * Fonte: tabela `router_payment_settings` (singleton id="singleton") — admin
 * atualiza manualmente. Cache em memória de 5 min pra evitar query por request
 * em páginas públicas (SSR).
 *
 * Fallback: 0.15 (R$ 0,15 por STAR) se a row ainda não foi criada (instância nova).
 */

export const FALLBACK_STAR_PRICE_BRL = 0.15;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { value: number; expiresAt: number } | null = null;

export async function getStarPriceBrl(): Promise<number> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const row = await prisma.routerPaymentSettings.findUnique({
    where: { id: "singleton" },
    select: { starPriceBrl: true },
  });
  const value = row ? Number(row.starPriceBrl) : FALLBACK_STAR_PRICE_BRL;

  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Invalida o cache — chamar após admin atualizar a cotação. */
export function invalidateStarPriceCache(): void {
  cache = null;
}

/** Converte STARS → BRL (formato número). */
export function starsToBrl(stars: number, starPriceBrl: number): number {
  return Math.round(stars * starPriceBrl * 100) / 100;
}

/** Converte STARS → centavos (BRL) — pra Stripe Checkout (`amount`). */
export function starsToBrlCents(stars: number, starPriceBrl: number): number {
  return Math.round(stars * starPriceBrl * 100);
}

/** "X STARS · R$ Y,YY" — formato pro CTA público de curso. */
export function formatStarsAndBrl(
  stars: number,
  starPriceBrl: number,
): string {
  const brl = starsToBrl(stars, starPriceBrl);
  const brlStr = brl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const starsStr = stars.toLocaleString("pt-BR");
  return `R$ ${brlStr.replace(/^R\$\s*/, "")} · ${starsStr} ★`;
}
