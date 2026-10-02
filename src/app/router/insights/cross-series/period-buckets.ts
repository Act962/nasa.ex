import type { DatedValue } from "./period-loaders";

/** Régua de períodos (dia, semana, mês) do Gráfico Cruzado. */

export type TimeBucket = "day" | "week" | "month";

const DAY_MS = 1000 * 60 * 60 * 24;
const MAX_DAILY_RANGE_DAYS = 45;
const MAX_WEEKLY_RANGE_DAYS = 200;
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function pickBucket(rangeStart: Date, rangeEnd: Date): TimeBucket {
  const rangeDays = (rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS;
  if (rangeDays <= MAX_DAILY_RANGE_DAYS) return "day";
  if (rangeDays <= MAX_WEEKLY_RANGE_DAYS) return "week";
  return "month";
}

function startOfBucket(date: Date, bucket: TimeBucket): Date {
  const bucketStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (bucket === "week") {
    // Semana começa na segunda-feira.
    const daysSinceMonday = (bucketStart.getDay() + 6) % 7;
    bucketStart.setDate(bucketStart.getDate() - daysSinceMonday);
  }
  if (bucket === "month") bucketStart.setDate(1);
  return bucketStart;
}

function bucketLabel(bucketStart: Date, bucket: TimeBucket): string {
  const dayMonth = `${String(bucketStart.getDate()).padStart(2, "0")}/${String(bucketStart.getMonth() + 1).padStart(2, "0")}`;
  if (bucket === "day") return dayMonth;
  if (bucket === "week") return `Sem ${dayMonth}`;
  return `${MONTH_LABELS[bucketStart.getMonth()]}/${String(bucketStart.getFullYear()).slice(2)}`;
}

export function listBuckets(rangeStart: Date, rangeEnd: Date, bucket: TimeBucket): Date[] {
  const buckets: Date[] = [];
  const cursor = startOfBucket(rangeStart, bucket);
  while (cursor <= rangeEnd) {
    buckets.push(new Date(cursor));
    if (bucket === "day") cursor.setDate(cursor.getDate() + 1);
    else if (bucket === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

const RELATIVE_LABEL_PREFIX: Record<TimeBucket, string> = { day: "Dia", week: "Semana", month: "Mês" };

/** "Sobrepor períodos": troca a data do rótulo pela posição dentro do período da própria série (Semana 1, 2…). */
export function toRelativeLabels(points: Array<{ name: string; value: number }>, bucket: TimeBucket) {
  return points.map((point, pointIndex) => ({ name: `${RELATIVE_LABEL_PREFIX[bucket]} ${pointIndex + 1}`, value: point.value }));
}

export function toBucketSeries(datedValues: DatedValue[], buckets: Date[], bucket: TimeBucket) {
  const totalsByBucket = new Map<number, number>();
  for (const datedValue of datedValues) {
    if (!datedValue.date) continue;
    const bucketKey = startOfBucket(datedValue.date, bucket).getTime();
    totalsByBucket.set(bucketKey, (totalsByBucket.get(bucketKey) ?? 0) + (datedValue.value ?? 1));
  }
  return buckets.map((bucketStart) => ({
    name: bucketLabel(bucketStart, bucket),
    value: Math.round((totalsByBucket.get(bucketStart.getTime()) ?? 0) * 100) / 100,
  }));
}
