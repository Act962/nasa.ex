/**
 * O card de metas só faz sentido sobre um mês fechado: a meta é mensal, e um
 * intervalo arbitrário do picker não tem meta correspondente (CB-6 da spec
 * 0011). Este helper reconhece quando o período selecionado é exatamente um
 * mês do calendário e devolve qual.
 */

export interface CalendarMonth {
  year: number;
  month: number;
}

export function monthFromPeriod(
  dateFrom?: string,
  dateTo?: string,
): CalendarMonth | null {
  if (!dateFrom || !dateTo) return null;

  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const year = start.getFullYear();
  const monthIndex = start.getMonth();

  // O store grava o período no fuso de quem escolheu; reconstruir com o mesmo
  // construtor é o que permite comparar sem depender de UTC.
  const expectedStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const expectedEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const sameStart = start.getTime() === expectedStart.getTime();
  const sameEnd = end.getTime() === expectedEnd.getTime();
  if (!sameStart || !sameEnd) return null;

  return { year, month: monthIndex + 1 };
}
