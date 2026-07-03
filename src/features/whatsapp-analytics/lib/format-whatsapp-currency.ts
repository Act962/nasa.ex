/**
 * A WABA pode ter moeda própria (USD, EUR, BRL...) — não dá pra reaproveitar
 * um formatter fixo em BRL. `currency` vem de `getWaba().currency`.
 */
export function formatWhatsAppCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
