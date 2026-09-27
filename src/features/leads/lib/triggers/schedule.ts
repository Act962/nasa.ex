// Janela de ativação do Gatilho do lead (spec 0038, RF-5). Puro e em horário de São Paulo.

/** São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019). */
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const MAX_DAYS_AHEAD = 14;

export interface TriggerWindow {
  windowStart: string;
  windowEnd: string;
  weekdays: number[];
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** O relógio de parede de São Paulo, representado em campos UTC. */
function toWallClock(date: Date): Date {
  return new Date(date.getTime() - SAO_PAULO_OFFSET_MS);
}

function fromWallClock(wall: Date): Date {
  return new Date(wall.getTime() + SAO_PAULO_OFFSET_MS);
}

export function isWithinWindow(date: Date, window: TriggerWindow): boolean {
  const wall = toWallClock(date);
  if (window.weekdays.length > 0 && !window.weekdays.includes(wall.getUTCDay())) return false;
  const minuteOfDay = wall.getUTCHours() * 60 + wall.getUTCMinutes();
  return minuteOfDay >= minutesOf(window.windowStart) && minuteOfDay < minutesOf(window.windowEnd);
}

/**
 * Primeiro instante ≥ `from` dentro da janela. Dentro dela, é o próprio `from`;
 * fora, a próxima abertura (hora inicial num dia permitido). `null` se a janela
 * não abre nos próximos 14 dias (configuração vazia ou impossível).
 */
export function nextWindowOpening(from: Date, window: TriggerWindow): Date | null {
  if (isWithinWindow(from, window)) return from;
  const startMinutes = minutesOf(window.windowStart);
  if (startMinutes >= minutesOf(window.windowEnd)) return null;
  const wallFrom = toWallClock(from);
  for (let dayOffset = 0; dayOffset <= MAX_DAYS_AHEAD; dayOffset++) {
    const wallDay = new Date(Date.UTC(wallFrom.getUTCFullYear(), wallFrom.getUTCMonth(), wallFrom.getUTCDate()) + dayOffset * DAY_MS);
    const candidate = fromWallClock(new Date(wallDay.getTime() + startMinutes * 60_000));
    if (candidate.getTime() >= from.getTime() && isWithinWindow(candidate, window)) return candidate;
  }
  return null;
}
