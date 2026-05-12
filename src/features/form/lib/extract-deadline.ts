/**
 * Procura no `jsonBlock` do form o primeiro bloco DatePicker marcado com
 * `attributes.useAsDeadline = true` e devolve o valor preenchido na
 * `jsonResponse` correspondente (ou null se não houver / não preenchido).
 *
 * O DatePicker salva no response como string em formato:
 *   - "yyyy-MM-dd"           (data simples)
 *   - "yyyy-MM-dd HH:mm"     (com hora — quando attributes.withTime=true)
 *
 * Ambos os formatos viram um `Date` no horário local. Se não conseguir
 * parsear (formato inesperado), retorna null em vez de quebrar.
 */

type AnyBlock = {
  id?: string;
  blockType?: string;
  attributes?: {
    useAsDeadline?: boolean;
    withTime?: boolean;
  };
  childblocks?: AnyBlock[];
};

type ParsedResponse = Record<
  string,
  { value?: unknown; meta?: Record<string, unknown> } | string | unknown
>;

function parseBlocks(jsonBlock: unknown): AnyBlock[] {
  if (typeof jsonBlock === "string") {
    try {
      const parsed = JSON.parse(jsonBlock);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(jsonBlock) ? (jsonBlock as AnyBlock[]) : [];
}

function parseResponse(jsonResponse: unknown): ParsedResponse {
  if (!jsonResponse) return {};
  if (typeof jsonResponse === "string") {
    try {
      return JSON.parse(jsonResponse) as ParsedResponse;
    } catch {
      return {};
    }
  }
  if (typeof jsonResponse === "object") return jsonResponse as ParsedResponse;
  return {};
}

function findDeadlineBlocks(blocks: AnyBlock[]): AnyBlock[] {
  const out: AnyBlock[] = [];
  function walk(node: AnyBlock | null | undefined) {
    if (!node || typeof node !== "object") return;
    if (
      node.blockType === "DatePicker" &&
      node.attributes?.useAsDeadline === true
    ) {
      out.push(node);
    }
    if (Array.isArray(node.childblocks)) {
      for (const c of node.childblocks) walk(c);
    }
  }
  for (const b of blocks) walk(b);
  return out;
}

function parseDateString(raw: string): Date | null {
  // Aceita "yyyy-MM-dd" ou "yyyy-MM-dd HH:mm". `new Date()` parsea os
  // dois, mas o segundo precisa virar formato ISO (com 'T') pra
  // funcionar consistente cross-browser.
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  // Normaliza "YYYY-MM-DD HH:mm" → "YYYY-MM-DDTHH:mm"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // Acrescenta T00:00 pra evitar parsing UTC do ISO date-only
    // (que daria 1 dia a menos em fusos negativos).
    s = `${s}T00:00`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Devolve o prazo (Date) configurado num form response. Se houver múltiplos
 * blocos com useAsDeadline=true, usa o PRIMEIRO encontrado em pré-ordem
 * (DFS) — convenção pra previsibilidade. Se nenhum prazo foi preenchido,
 * retorna null.
 */
export function extractDeadlineFromResponse(input: {
  jsonBlock: unknown;
  jsonResponse: unknown;
}): Date | null {
  const blocks = parseBlocks(input.jsonBlock);
  const deadlineBlocks = findDeadlineBlocks(blocks);
  if (deadlineBlocks.length === 0) return null;
  const response = parseResponse(input.jsonResponse);
  for (const b of deadlineBlocks) {
    if (!b.id) continue;
    const entry = response[b.id];
    const raw =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && "value" in entry
          ? String((entry as { value?: unknown }).value ?? "")
          : "";
    const d = parseDateString(raw);
    if (d) return d;
  }
  return null;
}

/**
 * Formata o tempo restante até `deadline` numa string curta tipo
 * "Faltam 02d 14h 03m" ou "Atrasado 01d 06h". `null` se inválido.
 */
export function formatTimeUntil(deadline: Date | null): {
  label: string;
  expired: boolean;
} | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const dd = Math.floor(absMs / (1000 * 60 * 60 * 24));
  const hh = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mm = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  const ss = Math.floor((absMs % (1000 * 60)) / 1000);

  // Formato compacto: pra >1 dia mostra "Xd Yh", pra <1 dia mostra "HH:MM:SS"
  let core: string;
  if (dd > 0) {
    core = `${dd}d ${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m`;
  } else {
    core = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  if (diffMs < 0) {
    return { label: `Atrasado ${core}`, expired: true };
  }
  return { label: `Faltam ${core}`, expired: false };
}
