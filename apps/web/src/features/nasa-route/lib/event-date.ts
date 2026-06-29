/**
 * Formatação compacta de datas pra capa de curso do tipo "event".
 *
 * Cobre 3 casos:
 *  - 1 dia, com hora: "13 mai · 19h00"
 *  - múltiplos dias mesmo mês: "13 a 15 mai"
 *  - múltiplos dias / meses diferentes: "30 mai – 02 jun"
 *
 * Sem timezone explícito o JS usa o do navegador — pra MVP é aceitável
 * (na grande maioria os criadores e alunos estão em -03:00). Se o criador
 * gravou um tz específico, ele aparece logo abaixo na badge.
 */

const dayMonthFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});
const dayOnlyFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function clean(s: string) {
  // "13 de mai" → "13 mai" / "13 de mai." → "13 mai"
  return s.replace(/\s+de\s+/g, " ").replace(/\.$/, "");
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export interface EventDateInput {
  startsAt: Date | string | null | undefined;
  endsAt?: Date | string | null | undefined;
}

export interface FormattedEventDate {
  /** Linha principal: data (ex: "13 mai", "13 a 15 mai"). */
  dateLine: string;
  /** Linha secundária (opcional): horário (ex: "19h00 – 21h30") ou null. */
  timeLine: string | null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function formatEventDate(
  input: EventDateInput,
): FormattedEventDate | null {
  const start = toDate(input.startsAt);
  if (!start) return null;
  const end = toDate(input.endsAt);

  // ── 1 dia (ou sem `endsAt`)
  if (!end || sameDay(start, end)) {
    return {
      dateLine: clean(dayMonthFmt.format(start)),
      timeLine: end
        ? `${hourFmt.format(start)} – ${hourFmt.format(end)}`
        : hourFmt.format(start),
    };
  }

  // ── Multi-day, mesmo mês: "13 a 15 mai"
  if (sameMonth(start, end)) {
    return {
      dateLine: `${dayOnlyFmt.format(start)} a ${clean(dayMonthFmt.format(end))}`,
      timeLine: null,
    };
  }

  // ── Multi-month: "30 mai – 02 jun"
  return {
    dateLine: `${clean(dayMonthFmt.format(start))} – ${clean(dayMonthFmt.format(end))}`,
    timeLine: null,
  };
}
