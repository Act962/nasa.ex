/**
 * Datas do OFX: `20250201000000[-3:BRT]`.
 *
 * Devolve dois valores de propósito. `postedAt` é o instante real. `postedDate`
 * é o dia do calendário gravado a meio-dia UTC — a mesma convenção de
 * `lib/dates.ts`, que é o que permite comparar com `PaymentEntry.dueDate` sem
 * que o fuso desloque a janela do match em um dia.
 */

const NOON = 12;

// AAAAMMDD[HHMMSS][.xxx][[offset:TZ]] — o offset pode ser fracionário (-3.5).
const OFX_DATE_PATTERN =
  /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?(?:\.\d+)?(?:\[\s*([+-]?\d+(?:\.\d+)?)\s*(?::[A-Z]{2,4})?\s*\])?/;

export interface OfxDate {
  postedAt: Date;
  postedDate: Date;
}

export function parseOfxDate(raw: string): OfxDate | null {
  const match = OFX_DATE_PATTERN.exec(raw.trim());
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0", second = "0", offset] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  const asUtc = Date.UTC(y, m - 1, d, Number(hour), Number(minute), Number(second));
  // O offset declarado diz em que fuso aquele relógio foi lido; para chegar ao
  // instante em UTC, desconta-se o offset.
  const offsetMs = offset ? Number(offset) * 3_600_000 : 0;
  const postedAt = new Date(asUtc - offsetMs);
  if (Number.isNaN(postedAt.getTime())) return null;

  return {
    postedAt,
    // O dia é o que o extrato afirma, não o dia derivado do instante: o próprio
    // banco já decidiu em que data aquilo entrou.
    postedDate: new Date(Date.UTC(y, m - 1, d, NOON, 0, 0, 0)),
  };
}
