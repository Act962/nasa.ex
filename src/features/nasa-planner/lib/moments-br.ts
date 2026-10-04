/** Datas comemorativas do Brasil para a aba Momentos do Planner (spec 0058, RF-9). Fixas por mês/dia; móveis calculadas. */

export interface MarketingMoment {
  key: string;
  label: string;
  /** "MM-DD" */
  monthDay: string;
}

const FIXED_MOMENTS: MarketingMoment[] = [
  { key: "ano-novo", label: "Ano Novo", monthDay: "01-01" },
  { key: "dia-mulher", label: "Dia Internacional da Mulher", monthDay: "03-08" },
  { key: "dia-consumidor", label: "Dia do Consumidor", monthDay: "03-15" },
  { key: "tiradentes", label: "Tiradentes", monthDay: "04-21" },
  { key: "dia-trabalho", label: "Dia do Trabalho", monthDay: "05-01" },
  { key: "dia-namorados", label: "Dia dos Namorados", monthDay: "06-12" },
  { key: "festa-junina", label: "Festa Junina (São João)", monthDay: "06-24" },
  { key: "dia-amigo", label: "Dia do Amigo", monthDay: "07-20" },
  { key: "dia-cliente", label: "Dia do Cliente", monthDay: "09-15" },
  { key: "independencia", label: "Independência do Brasil", monthDay: "09-07" },
  { key: "dia-criancas", label: "Dia das Crianças", monthDay: "10-12" },
  { key: "dia-professor", label: "Dia do Professor", monthDay: "10-15" },
  { key: "halloween", label: "Halloween", monthDay: "10-31" },
  { key: "finados", label: "Finados", monthDay: "11-02" },
  { key: "proclamacao", label: "Proclamação da República", monthDay: "11-15" },
  { key: "consciencia-negra", label: "Dia da Consciência Negra", monthDay: "11-20" },
  { key: "natal", label: "Natal", monthDay: "12-25" },
  { key: "reveillon", label: "Réveillon", monthDay: "12-31" },
];

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + offset + (occurrence - 1) * 7));
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offset = (lastDay.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, lastDay.getUTCDate() - offset));
}

function movableMoments(year: number): Array<{ key: string; label: string; date: Date }> {
  const mothersDay = nthWeekdayOfMonth(year, 4, 0, 2);
  const fathersDay = nthWeekdayOfMonth(year, 7, 0, 2);
  const blackFriday = lastWeekdayOfMonth(year, 10, 5);
  const cyberMonday = new Date(blackFriday.getTime() + 3 * 24 * 60 * 60 * 1000);
  return [
    { key: "dia-maes", label: "Dia das Mães", date: mothersDay },
    { key: "dia-pais", label: "Dia dos Pais", date: fathersDay },
    { key: "black-friday", label: "Black Friday", date: blackFriday },
    { key: "cyber-monday", label: "Cyber Monday", date: cyberMonday },
  ];
}

/** Momentos entre `from` e `to` (datas em UTC à meia-noite do dia). */
export function listMomentsBetween(from: Date, to: Date) {
  const moments: Array<{ key: string; label: string; date: Date }> = [];
  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year++) {
    for (const moment of FIXED_MOMENTS) {
      const [month, day] = moment.monthDay.split("-").map(Number);
      moments.push({ key: moment.key, label: moment.label, date: new Date(Date.UTC(year, month - 1, day)) });
    }
    moments.push(...movableMoments(year));
  }
  return moments
    .filter((moment) => moment.date >= from && moment.date <= to)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}
