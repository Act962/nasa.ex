/**
 * Datas de calendário do financeiro (vencimento, competência).
 *
 * O bug que motivou este módulo: `<input type="date">` entrega "2026-09-01" e
 * `new Date("2026-09-01")` resolve para meia-noite **UTC**. Em qualquer fuso
 * negativo — America/Sao_Paulo é UTC-3 — esse instante ainda é 31/08 no
 * horário local, e o lançamento aparecia salvo um dia antes do escolhido.
 *
 * A solução tem duas metades e as duas são necessárias:
 *   1. Gravar meio-dia UTC. Ao meio-dia, o dia do calendário é o mesmo de
 *      UTC-11 a UTC+11, então nenhum fuso desloca a data.
 *   2. Exibir em UTC. Isso também conserta os registros antigos, gravados à
 *      meia-noite UTC antes desta correção.
 *
 * Datas com hora real (`paidAt`, `createdAt`) não passam por aqui — são
 * instantes, não dias, e devem ser exibidas no fuso de quem lê.
 */

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NOON = 12;

/**
 * Converte o valor de um campo de data para o `Date` que vai ao banco.
 * Aceita tanto "2026-09-01" (campo de formulário) quanto um ISO completo
 * (chamadas que já mandam timestamp, como o painel de orçamento do chat) —
 * nesse segundo caso o instante é preservado como veio.
 */
export function parseCalendarDate(value: string): Date {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return new Date(value);

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, NOON, 0, 0, 0));
}

/** `true` se a string vira uma data real — pega "2026-02-31" e lixo em geral. */
export function isValidDateValue(value: string): boolean {
  const parsed = parseCalendarDate(value);
  if (Number.isNaN(parsed.getTime())) return false;

  // O construtor normaliza overflow (31/02 vira 03/03); comparar de volta é o
  // que diferencia uma data inexistente de uma válida.
  if (CALENDAR_DATE_PATTERN.test(value)) {
    return toDateInputValue(parsed) === value;
  }
  return true;
}

/** Data de calendário como DD/MM/YYYY, lida em UTC. */
export function formatCalendarDate(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return parsed.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Data de calendário no formato aceito por `<input type="date">`. */
export function toDateInputValue(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return parsed.toISOString().slice(0, 10);
}

/** Hoje no formato do `<input type="date">`, pelo calendário de quem preenche. */
export function todayAsDateInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Soma meses a uma data de calendário preservando meio-dia UTC.
 *
 * Usa os setters UTC e trava no último dia do mês de destino: `setMonth` puro
 * transborda — 31/01 + 1 mês vira 03/03 — e uma parcela pulava de mês.
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + months + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(year, month + months, Math.min(day, lastDayOfTargetMonth), NOON, 0, 0, 0),
  );
}
