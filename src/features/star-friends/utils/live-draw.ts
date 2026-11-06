// Regras puras do sorteio ao vivo (spec 0134), usadas no servidor e na tela.

export const DRAW_REVOKE_WINDOW_MINUTES = 30;
export const DRAW_REVOKE_WINDOW_MS = DRAW_REVOKE_WINDOW_MINUTES * 60 * 1000;

export function revocableUntil(drawnAt: Date | string): Date {
  return new Date(new Date(drawnAt).getTime() + DRAW_REVOKE_WINDOW_MS);
}

export function isDrawRevocable(draw: { drawnAt: Date | string; revokedAt: Date | string | null }, now: Date = new Date()): boolean {
  return !draw.revokedAt && revocableUntil(draw.drawnAt).getTime() > now.getTime();
}

/** Menor posição de prêmio ainda livre: depois de uma revogação, o próximo sorteio repõe o prêmio revogado. */
export function nextFreePosition(takenPositions: number[], prizeCount: number): number | null {
  const taken = new Set(takenPositions);
  for (let position = 1; position <= prizeCount; position++) {
    if (!taken.has(position)) return position;
  }
  return null;
}

/** Telefone para mostrar em telão: DDD e os 4 últimos dígitos. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length < 6) return "••••";
  return `(${national.slice(0, 2)}) •••••-${national.slice(-4)}`;
}

export function firstAndLastName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join(" ");
  return `${words[0]} ${words[words.length - 1]}`;
}
