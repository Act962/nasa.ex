// Evento de janela disparado pela calculadora de markup: a seção "Produtos &
// Preços" (e a simulação do Forge) escuta e aplica o preço sugerido. Evento em
// vez de store porque o emissor e o ouvinte vivem em árvores diferentes (Sheet).
// Como a calculadora costuma navegar para "pricing" logo depois, o ouvinte pode
// ainda não estar montado: o último detalhe fica guardado e é lido com
// `consumePendingApplyPrice()` no mount do ouvinte.
export const APPLY_PRICE_EVENT = "accounting:apply-price";

export interface ApplyPriceEventDetail {
  priceCents: number;
  taxRateBps: number;
}

let pendingApplyPrice: ApplyPriceEventDetail | null = null;

export function dispatchApplyPrice(detail: ApplyPriceEventDetail): void {
  pendingApplyPrice = detail;
  window.dispatchEvent(new CustomEvent<ApplyPriceEventDetail>(APPLY_PRICE_EVENT, { detail }));
}

/** Devolve (e limpa) o preço enviado antes de o ouvinte montar. Chame também ao tratar o evento. */
export function consumePendingApplyPrice(): ApplyPriceEventDetail | null {
  const detail = pendingApplyPrice;
  pendingApplyPrice = null;
  return detail;
}
