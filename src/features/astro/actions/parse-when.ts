import "server-only";

// Resolver "sexta às 15h", "amanhã 9h", "toda segunda" em data absoluta.
//
// Fica em código e não no prompt por dois motivos medidos: o classificador
// não sabe que dia é hoje, e injetar contexto temporal no prompt dele
// degradou a classificação dos outros verbos (7 falhas contra 2). Calendário
// é conta — código faz melhor, de graça e sempre igual.

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

// Brasil sem horário de verão desde 2019: o fuso é fixo. Calcular no relógio
// do servidor errava em produção (UTC) — "14h" virava 11h para o usuário.
const BRAZIL_OFFSET_MINUTES = -180;
const BRAZIL_OFFSET_SUFFIX = "-03:00";

/** Instante real → "relógio de parede" de Brasília, lido com getUTC*. */
function toBrazilWallClock(instant: Date): Date {
  return new Date(instant.getTime() + BRAZIL_OFFSET_MINUTES * 60_000);
}

function fromBrazilWallClock(wallClock: Date): Date {
  return new Date(wallClock.getTime() - BRAZIL_OFFSET_MINUTES * 60_000);
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface TimeMatch {
  hour: number;
  minute: number;
  raw: string;
  index: number;
}

/**
 * Hora dita por extenso: "meio dia", "meio-dia e meia", "meia noite", "3 da tarde".
 * Sem isto, "meio dia" respondendo a "que horas?" não era hora nenhuma e o Astro voltava a perguntar o dia.
 */
function findSpokenTime(text: string): TimeMatch | null {
  const noon = /\bmeio[- ]dia(\s+e\s+meia)?\b/.exec(text);
  if (noon) return { hour: 12, minute: noon[1] ? 30 : 0, raw: noon[0], index: noon.index };
  const midnight = /\bmeia[- ]noite(\s+e\s+meia)?\b/.exec(text);
  if (midnight) return { hour: 0, minute: midnight[1] ? 30 : 0, raw: midnight[0], index: midnight.index };
  const afternoon = /\b(\d{1,2})(?:\s*(?:h|horas?))?(?:\s*e\s+(meia)|\s*[:h]\s*(\d{2}))?\s+da\s+(tarde|noite)\b/.exec(text);
  if (afternoon) {
    const spokenHour = Number(afternoon[1]);
    return {
      hour: spokenHour < 12 ? spokenHour + 12 : spokenHour,
      minute: afternoon[2] ? 30 : Number(afternoon[3] ?? 0),
      raw: afternoon[0],
      index: afternoon.index,
    };
  }
  return null;
}

/** Primeira hora da frase, em número ("14h30", "9 horas") ou por extenso. Vale a que aparece antes. */
function findTimeMatch(text: string): TimeMatch | null {
  const spoken = findSpokenTime(text);
  const numeric = /\b(\d{1,2})\s*(?:[:h]\s*(\d{2})\b|h\b|horas?\b)/.exec(text);
  const written: TimeMatch | null = numeric
    ? { hour: Number(numeric[1]), minute: Number(numeric[2] ?? 0), raw: numeric[0], index: numeric.index }
    : null;
  if (spoken && written) return spoken.index <= written.index ? spoken : written;
  return spoken ?? written;
}

function extractTime(text: string): { hour: number; minute: number } | null {
  const match = findTimeMatch(text);
  return match ? { hour: match.hour, minute: match.minute } : null;
}

/**
 * ISO vindo do classificador. Ele não sabe que dia é hoje e já devolveu
 * 2023-10-02 para "segunda às 14h" — data no passado é descartada.
 */
function parseIsoFromModel(text: string, now: Date): string | null {
  const iso = text.match(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+)?(?:Z|[+-]\d{2}:?\d{2})?/);
  if (!iso) return null;
  const raw = iso[0];
  const hasTime = raw.includes("T");
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) && hasTime;
  const parsed = new Date(hasOffset ? raw : `${hasTime ? raw : `${raw}T12:00`}${BRAZIL_OFFSET_SUFFIX}`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() < now.getTime() - 60 * 60_000) return null;
  return parsed.toISOString();
}

type DayShift = (wallClock: Date) => boolean;

interface DayExpression {
  index: number;
  /** Move o relógio de parede para o dia dito; `false` = data impossível. */
  apply: DayShift;
}

function shiftDays(days: number): DayShift {
  return (wallClock) => {
    wallClock.setUTCDate(wallClock.getUTCDate() + days);
    return true;
  };
}

/**
 * Todas as expressões de dia da frase, com a posição. Vence a primeira: numa
 * resposta encadeada ("quinta 9h" + a frase original com "segunda"), é a
 * palavra nova que vem na frente.
 */
function findDayExpressions(normalized: string, now: Date): DayExpression[] {
  const found: DayExpression[] = [];
  const addFixedShift = (pattern: RegExp, days: number) => {
    const match = pattern.exec(normalized);
    if (match) found.push({ index: match.index, apply: shiftDays(days) });
  };

  addFixedShift(/\bdepois de amanha\b/, 2);
  // "amanhã" solto; o de "depois de amanhã" já entrou acima.
  // "amanhãs" é erro de digitação comum; conta como amanhã.
  addFixedShift(/(?<!depois de )\bamanhas?\b/, 1);
  addFixedShift(/\bhoje\b/, 0);
  addFixedShift(/\bontem\b/, -1);

  const brazilianDate = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(normalized);
  if (brazilianDate) {
    found.push({
      index: brazilianDate.index,
      apply: (wallClock) => {
        const month = Number(brazilianDate[2]) - 1;
        const rawYear = brazilianDate[3] ? Number(brazilianDate[3]) : wallClock.getUTCFullYear();
        wallClock.setUTCFullYear(rawYear < 100 ? 2000 + rawYear : rawYear, month, Number(brazilianDate[1]));
        if (wallClock.getUTCMonth() !== month) return false;
        if (!brazilianDate[3] && fromBrazilWallClock(wallClock) < now) {
          wallClock.setUTCFullYear(wallClock.getUTCFullYear() + 1);
        }
        return true;
      },
    });
  }

  // "dia 5": o próximo dia 5 — este mês se ainda não passou, senão o seguinte.
  const dayOfMonth = /\bdia (\d{1,2})\b(?!\s*\/)/.exec(normalized);
  if (dayOfMonth) {
    found.push({
      index: dayOfMonth.index,
      apply: (wallClock) => {
        const day = Number(dayOfMonth[1]);
        if (day < 1 || day > 31) return false;
        if (wallClock.getUTCDate() >= day) wallClock.setUTCMonth(wallClock.getUTCMonth() + 1, 1);
        const month = wallClock.getUTCMonth();
        wallClock.setUTCDate(day);
        return wallClock.getUTCMonth() === month;
      },
    });
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    const match = new RegExp(`\\b${stripAccents(name)}\\b`).exec(normalized);
    if (!match) continue;
    found.push({
      index: match.index,
      // Próxima ocorrência; "sexta" dita numa sexta significa a que vem.
      apply: (wallClock) => {
        const delta = (weekday - wallClock.getUTCDay() + 7) % 7 || 7;
        wallClock.setUTCDate(wallClock.getUTCDate() + delta);
        return true;
      },
    });
  }

  return found.sort((first, second) => first.index - second.index);
}

/** Hora escrita, mesmo fora de 0–23 ("25h"), para poder recusar em vez de rolar o dia. */
function findRawTime(normalized: string): { hour: number; minute: number; raw: string } | null {
  return findTimeMatch(normalized);
}

/**
 * Devolve ISO 8601 ou `null` quando a frase não traz quando. `null` vira
 * pergunta ao usuário — melhor do que inventar um horário. Palavras do
 * usuário ("segunda", "amanhã", "02/10") vencem o ISO que o modelo calculou.
 * Dia sem hora usa a hora atual: serve a quem só precisa da data (validade,
 * vencimento). Compromisso usa `parseDateTime`, que pergunta a hora.
 */
export function parseWhen(text: string, now = new Date()): string | null {
  const normalized = stripAccents(text.toLowerCase());
  const time = extractTime(normalized);

  const target = toBrazilWallClock(now);
  target.setUTCSeconds(0, 0);
  if (time) target.setUTCHours(time.hour, time.minute);
  const done = () => fromBrazilWallClock(target).toISOString();

  const [firstDay] = findDayExpressions(normalized, now);
  if (firstDay) return firstDay.apply(target) ? done() : null;

  const isoFromModel = parseIsoFromModel(text, now);
  if (isoFromModel) return isoFromModel;

  // Só horário, sem dia: é hoje se ainda não passou, senão amanhã.
  if (time) {
    if (fromBrazilWallClock(target) <= now) target.setUTCDate(target.getUTCDate() + 1);
    return done();
  }

  return null;
}

export type DateTimeParse =
  | { status: "ok"; iso: string }
  /** Entendeu o dia, faltou a hora. */
  | { status: "missing_time"; dateIso: string }
  /** Não há dia nem hora na frase. */
  | { status: "missing_date" }
  /** Hora impossível, como "25h" ou "10:75". */
  | { status: "invalid_time"; rawTime: string }
  /** Data e hora entendidas, mas já passaram. */
  | { status: "past"; iso: string };

/**
 * Data e hora de um compromisso (spec 0033, RF-3). Diferente de `parseWhen`,
 * nunca completa sozinho o que faltou: dia sem hora pede a hora, hora
 * impossível é recusada e horário no passado volta para o usuário decidir.
 */
export function parseDateTime(text: string, now = new Date()): DateTimeParse {
  const normalized = stripAccents(text.toLowerCase());
  const rawTime = findRawTime(normalized);
  if (rawTime && (rawTime.hour > 23 || rawTime.minute > 59)) {
    return { status: "invalid_time", rawTime: rawTime.raw.trim() };
  }

  const hasDay = findDayExpressions(normalized, now).length > 0;
  const isoFromModel = hasDay ? null : parseIsoFromModel(text, now);
  if (isoFromModel && /T\d/.test(text)) return { status: "ok", iso: isoFromModel };

  if (!hasDay && !rawTime) return { status: "missing_date" };

  const iso = parseWhen(text, now);
  if (!iso) return { status: "missing_date" };
  if (!rawTime) return { status: "missing_time", dateIso: iso };
  if (new Date(iso).getTime() < now.getTime() - 60_000) return { status: "past", iso };
  return { status: "ok", iso };
}

/**
 * Data de calendário em português para ISO: "02/10/2026", "02/10", "7 dias",
 * "em 2 semanas", "1 mês". Validade e vencimento chegam assim do
 * classificador, e o `datetime()` dos schemas recusava — o Astro pedia a
 * validade de novo, em loop. Cai em `parseWhen` para "amanhã", "sexta".
 */
export function parseCalendarDate(text: string, now = new Date()): string | null {
  const normalized = stripAccents(text.toLowerCase()).trim();

  const brazilianDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (brazilianDate) {
    const day = Number(brazilianDate[1]);
    const month = Number(brazilianDate[2]) - 1;
    const wallNow = toBrazilWallClock(now);
    const rawYear = brazilianDate[3] ? Number(brazilianDate[3]) : wallNow.getUTCFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const target = new Date(Date.UTC(year, month, day, 23, 59, 0, 0));
    if (target.getUTCMonth() !== month) return null;
    // "02/10" sem ano e já passado quer dizer o do ano que vem.
    if (!brazilianDate[3] && fromBrazilWallClock(target) < now) {
      target.setUTCFullYear(year + 1);
    }
    return fromBrazilWallClock(target).toISOString();
  }

  const relative = normalized.match(/\b(\d{1,3})\s*(dias?|semanas?|mes|meses)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const target = toBrazilWallClock(now);
    target.setUTCHours(23, 59, 0, 0);
    if (relative[2].startsWith("dia")) target.setUTCDate(target.getUTCDate() + amount);
    else if (relative[2].startsWith("semana")) target.setUTCDate(target.getUTCDate() + amount * 7);
    else target.setUTCMonth(target.getUTCMonth() + amount);
    return fromBrazilWallClock(target).toISOString();
  }

  return parseWhen(text, now);
}
