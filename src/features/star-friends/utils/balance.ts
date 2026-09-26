// Regras puras do extrato — sem banco, para o saldo nunca depender de um
// campo acumulado que possa divergir do histórico.

export type LedgerLine = { stars: number };

export function sumBalance(entries: LedgerLine[]): number {
  return entries.reduce((total, entry) => total + entry.stars, 0);
}

export function canAfford(balance: number, costStars: number): boolean {
  return costStars > 0 && balance >= costStars;
}

// Expira no máximo o que ainda há de saldo: stars já trocadas não voltam a sair.
export function starsToExpire(earnedStars: number, currentBalance: number): number {
  return Math.max(0, Math.min(earnedStars, currentBalance));
}

export function toMemberPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
