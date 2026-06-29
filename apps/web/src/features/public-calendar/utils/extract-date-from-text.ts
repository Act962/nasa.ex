/**
 * Extrai datas de evento de texto livre em português brasileiro.
 *
 * Usado como FALLBACK pelo parser quando JSON-LD/OG não trouxe
 * `startDate` estruturado. Muitas páginas (especialmente sites de
 * portais não-otimizados pra SEO de evento) escondem a data dentro
 * da descrição: "15 e 16 de maio de 2026" / "10 a 15 de janeiro".
 *
 * Retorna `{ startDate, endDate }` como ISO strings, ou `null` se
 * nada bateu. Quando o range é só 1 dia (single date), `endDate`
 * fica igual ao `startDate`.
 *
 * Sem libs novas — só regex.
 */

const MONTHS: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  fevereiro: 1,
  mar: 2,
  marco: 2,
  "março": 2,
  abr: 3,
  abril: 3,
  mai: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  setembro: 8,
  out: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dezembro: 11,
};

function monthFrom(s: string): number | null {
  const key = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return MONTHS[key] ?? null;
}

/**
 * Constrói ISO string `YYYY-MM-DDT12:00:00.000Z`. Usa meio-dia UTC pra
 * evitar drift de fuso (data salva como dia X, lida como dia X em
 * qualquer timezone razoável).
 */
function toIsoDate(year: number, monthIdx: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  if (monthIdx < 0 || monthIdx > 11) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== monthIdx ||
    d.getUTCDate() !== day
  ) {
    // Data inválida (ex: 31 de fevereiro) — JS rola pro mês seguinte.
    return null;
  }
  return d.toISOString();
}

export type ExtractedDates = {
  startDate: string;
  endDate: string;
};

export function extractDateFromText(rawText: string | null | undefined): ExtractedDates | null {
  if (!rawText) return null;
  const text = rawText.toLowerCase();
  const currentYear = new Date().getUTCFullYear();

  // ── Padrão 1: "10 e 11 de maio de 2026" OU "10 a 15 de janeiro de 2026"
  // OU "10 a 15 de janeiro" (assume ano atual)
  // Separadores aceitos: "e", "a", "até", "ao", "-", "–"
  // Suporta abreviações de mês.
  {
    const pat =
      /(\d{1,2})\s*(?:e|a|at[eé]|ao|-|–)\s*(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\s+de\s+(\d{4}))?/i;
    const m = text.match(pat);
    if (m) {
      const d1 = parseInt(m[1], 10);
      const d2 = parseInt(m[2], 10);
      const month = monthFrom(m[3]);
      const year = m[4] ? parseInt(m[4], 10) : currentYear;
      if (month !== null) {
        const start = toIsoDate(year, month, d1);
        const end = toIsoDate(year, month, d2);
        if (start && end) return { startDate: start, endDate: end };
      }
    }
  }

  // ── Padrão 2: range com slash/hífen "10/05/2026 a 15/05/2026"
  // Ou "10/05 a 15/05" (assume ano atual).
  {
    const pat =
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:a|at[eé]|-|–|ao)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i;
    const m = text.match(pat);
    if (m) {
      const d1 = parseInt(m[1], 10);
      const mo1 = parseInt(m[2], 10) - 1;
      const y1 = m[3]
        ? parseInt(m[3].length === 2 ? "20" + m[3] : m[3], 10)
        : currentYear;
      const d2 = parseInt(m[4], 10);
      const mo2 = parseInt(m[5], 10) - 1;
      const y2 = m[6]
        ? parseInt(m[6].length === 2 ? "20" + m[6] : m[6], 10)
        : y1;
      const start = toIsoDate(y1, mo1, d1);
      const end = toIsoDate(y2, mo2, d2);
      if (start && end) return { startDate: start, endDate: end };
    }
  }

  // ── Padrão 3: data única "15 de maio de 2026" ou "15 de maio"
  {
    const pat =
      /(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\s+de\s+(\d{4}))?/i;
    const m = text.match(pat);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = monthFrom(m[2]);
      const year = m[3] ? parseInt(m[3], 10) : currentYear;
      if (month !== null) {
        const iso = toIsoDate(year, month, day);
        if (iso) return { startDate: iso, endDate: iso };
      }
    }
  }

  // ── Padrão 4: data única slash "10/05/2026" ou "10/05"
  {
    const pat = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
    const m = text.match(pat);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = m[3]
        ? parseInt(m[3].length === 2 ? "20" + m[3] : m[3], 10)
        : currentYear;
      const iso = toIsoDate(year, month, day);
      if (iso) return { startDate: iso, endDate: iso };
    }
  }

  return null;
}
