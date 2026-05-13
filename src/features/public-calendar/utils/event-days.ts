import dayjs from "dayjs";
import type { PublicEvent } from "../types";

/**
 * Expande um evento na lista de TODAS as datas (YYYY-MM-DD) em que ele
 * ocorre — útil pra agrupar por dia mostrando o evento em cada dia de
 * sua duração, não só no dia de início.
 *
 *   - Sem `startDate` → `[]` (evento sem data não aparece em nenhum dia)
 *   - Sem `endDate` e sem `dueDate` → 1 entrada (só o dia de `startDate`)
 *   - Caso contrário → todos os dias entre `startDate` e o MAIOR entre
 *     `endDate` e `dueDate` (inclusive), independente de horário.
 *
 * Por que `dueDate` conta como fim? No model Action, eventos do
 * Calendário Público são criados via fluxo `criar-evento` que popula
 * `dueDate` como data fim (não `endDate`). Sem considerar, eventos
 * multi-dia (05→12) só apareciam no dia 05. Aceitar ambos cobre os
 * dois fluxos de criação sem mudança de schema.
 *
 * Edge case do horário: se a data fim é "11/05 03:00", o evento ainda
 * conta no dia 11 (qualquer encosto no dia já incluí). Usa `startOf
 * ('day')` pra normalizar.
 *
 * Hard limit de 90 dias pra evitar travar a UI se vier data absurda
 * (ex: dados ruim do banco) — eventos legítimos não passam disso.
 */
export function expandEventToDays(event: PublicEvent): string[] {
  if (!event.startDate) return [];
  const start = dayjs(event.startDate).startOf("day");
  // Fim do evento = MAIOR entre endDate e dueDate (qualquer um que esteja
  // preenchido). Ignora horários — só importa o dia.
  const candidates = [event.endDate, event.dueDate]
    .filter((d): d is Date | string => !!d)
    .map((d) => dayjs(d).startOf("day"));
  let end = start;
  for (const c of candidates) {
    if (c.isAfter(end)) end = c;
  }

  // Sanidade: end < start → trata como evento de 1 dia.
  if (end.isBefore(start)) {
    return [start.format("YYYY-MM-DD")];
  }

  const days: string[] = [];
  let cursor = start;
  const MAX_DAYS = 90;
  let i = 0;
  while (!cursor.isAfter(end) && i < MAX_DAYS) {
    days.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
    i++;
  }
  return days;
}

/**
 * Agrupa eventos por dia, REPETINDO o evento em cada um dos seus dias
 * (não apenas no startDate). Resultado: `Map<YYYY-MM-DD, PublicEvent[]>`.
 * Eventos sem startDate são ignorados.
 */
export function groupEventsByDay(
  events: PublicEvent[],
): Map<string, PublicEvent[]> {
  const map = new Map<string, PublicEvent[]>();
  for (const ev of events) {
    const days = expandEventToDays(ev);
    for (const key of days) {
      const arr = map.get(key);
      if (arr) arr.push(ev);
      else map.set(key, [ev]);
    }
  }
  return map;
}
