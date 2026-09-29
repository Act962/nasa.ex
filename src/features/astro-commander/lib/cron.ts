/**
 * Cron mínimo do ASTRO COMMANDER (spec 0028).
 *
 * Cinco campos padrão: minuto, hora, dia do mês, mês, dia da semana. Aceita
 * `*`, número, lista (`1,15`), intervalo (`1-5`) e passo (`*​/15`). Não há
 * dependência nova: o que precisamos é isto, e o cálculo do próximo disparo
 * precisa respeitar o fuso da organização, coisa que biblioteca genérica
 * resolve com mais peso do que o caso pede.
 */

const FIELD_RANGES: Array<[min: number, max: number]> = [
  [0, 59], // minuto
  [0, 23], // hora
  [1, 31], // dia do mês
  [1, 12], // mês
  [0, 6], // dia da semana (0 = domingo)
];

export type CronFields = number[][];

export function parseCron(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const fields: CronFields = [];
  for (let index = 0; index < 5; index++) {
    const values = parseField(parts[index]!, FIELD_RANGES[index]!);
    if (!values) return null;
    fields.push(values);
  }
  return fields;
}

export function isValidCron(expression: string): boolean {
  return parseCron(expression) !== null;
}

function parseField(raw: string, [min, max]: [number, number]): number[] | null {
  const values = new Set<number>();

  for (const chunk of raw.split(",")) {
    const [rangePart, stepPart] = chunk.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return null;

    let start = min;
    let end = max;
    if (rangePart !== "*" && rangePart !== undefined) {
      const bounds = rangePart.split("-");
      if (bounds.length === 1) {
        start = Number(bounds[0]);
        end = stepPart === undefined ? start : max;
      } else if (bounds.length === 2) {
        start = Number(bounds[0]);
        end = Number(bounds[1]);
      } else {
        return null;
      }
      if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
      if (start < min || end > max || start > end) return null;
    }

    for (let value = start; value <= end; value += step) values.add(value);
  }

  if (values.size === 0) return null;
  return [...values].sort((left, right) => left - right);
}

interface LocalParts {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  weekday: number;
}

/** Quebra um instante nos campos do fuso pedido, sem depender do fuso do servidor. */
export function toLocalParts(date: Date, timezone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const weekdayLabel = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    minute: read("minute"),
    // Em fuso 24h, meia-noite pode vir como 24.
    hour: read("hour") % 24,
    dayOfMonth: read("day"),
    month: read("month"),
    weekday: Math.max(0, weekdays.indexOf(weekdayLabel)),
  };
}

function matches(fields: CronFields, parts: LocalParts): boolean {
  const [minutes, hours, daysOfMonth, months, weekdays] = fields as [
    number[],
    number[],
    number[],
    number[],
    number[],
  ];
  if (!minutes.includes(parts.minute)) return false;
  if (!hours.includes(parts.hour)) return false;
  if (!months.includes(parts.month)) return false;

  // Regra do cron: com dia do mês E dia da semana restritos, vale o OU.
  const dayOfMonthRestricted = daysOfMonth.length < 31;
  const weekdayRestricted = weekdays.length < 7;
  const dayOfMonthHit = daysOfMonth.includes(parts.dayOfMonth);
  const weekdayHit = weekdays.includes(parts.weekday);

  if (dayOfMonthRestricted && weekdayRestricted) return dayOfMonthHit || weekdayHit;
  if (dayOfMonthRestricted) return dayOfMonthHit;
  if (weekdayRestricted) return weekdayHit;
  return true;
}

const MINUTE_MS = 60_000;
/** Teto da busca: um ano e pouco cobre qualquer cron de 5 campos que case. */
const MAX_LOOKAHEAD_MINUTES = 370 * 24 * 60;

/**
 * Próximo instante em que o cron casa, estritamente depois de `from`.
 * Devolve `null` quando a expressão é inválida ou nunca casa (ex.: 30 de fevereiro).
 */
export function computeNextRun(
  expression: string,
  timezone: string,
  from: Date = new Date(),
): Date | null {
  const fields = parseCron(expression);
  if (!fields) return null;

  // Começa no minuto seguinte, zerando segundos: o tick roda a cada minuto.
  const cursor = new Date(from.getTime() + MINUTE_MS);
  cursor.setSeconds(0, 0);

  for (let step = 0; step < MAX_LOOKAHEAD_MINUTES; step++) {
    const candidate = new Date(cursor.getTime() + step * MINUTE_MS);
    let parts: LocalParts;
    try {
      parts = toLocalParts(candidate, timezone);
    } catch {
      // Fuso inválido: não dá para agendar com segurança.
      return null;
    }
    if (matches(fields, parts)) return candidate;
  }
  return null;
}

const WEEKDAY_LABELS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/** Descrição em português para a lista de comandos e o card de revisão. */
export function describeCron(expression: string): string {
  const fields = parseCron(expression);
  if (!fields) return expression;
  const [minutes, hours, daysOfMonth, months, weekdays] = fields as [
    number[],
    number[],
    number[],
    number[],
    number[],
  ];

  const time =
    minutes.length === 1 && hours.length === 1
      ? `${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`
      : null;

  if (minutes.length === 60 && hours.length === 24) return "A cada minuto";
  if (minutes.length > 1 && hours.length === 24) {
    const interval = (minutes[1] ?? 0) - (minutes[0] ?? 0);
    if (interval > 0) return `A cada ${interval} minutos`;
  }
  if (time && hours.length === 1 && minutes.length === 1) {
    if (weekdays.length < 7) {
      const names = weekdays.map((day) => WEEKDAY_LABELS[day]).join(", ");
      return `Toda ${names} às ${time}`;
    }
    if (daysOfMonth.length < 31) {
      return `Todo dia ${daysOfMonth.join(", ")} às ${time}`;
    }
    if (months.length < 12) return `Nos meses ${months.join(", ")} às ${time}`;
    return `Todo dia às ${time}`;
  }
  return expression;
}
