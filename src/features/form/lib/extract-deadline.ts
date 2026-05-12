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

/**
 * Configuração de "Zerar Cronômetro quando..." — quando QUALQUER um
 * dos triggers acontecer, o badge do cronômetro deixa de aparecer
 * (prazo cumprido).
 *
 * Estrutura `ids[]` (multi-select): lógica OR entre os items de cada
 * trigger E lógica OR entre os triggers.
 */
export type ResetTriggers = {
  trackingIds?: string[];
  statusIds?: string[];
  tagIds?: string[];
  formIds?: string[];
  nextGroupIds?: string[];
};

type AnyBlock = {
  id?: string;
  blockType?: string;
  attributes?: {
    useAsDeadline?: boolean;
    withTime?: boolean;
    resetTriggers?: ResetTriggers;
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
  const configs = extractDeadlineConfigsFromResponse(input);
  return configs.length > 0 ? configs[0].date : null;
}

/**
 * Versão completa que devolve TODOS os deadlines (com triggers) — usada
 * pelo server pra cruzar com `LeadJourneyEvent` e descartar prazos
 * cumpridos antes de agregar `deadlineHint`.
 */
export type DeadlineConfig = {
  date: Date;
  blockId: string;
  resetTriggers?: ResetTriggers;
};

export function extractDeadlineConfigsFromResponse(input: {
  jsonBlock: unknown;
  jsonResponse: unknown;
}): DeadlineConfig[] {
  const blocks = parseBlocks(input.jsonBlock);
  const deadlineBlocks = findDeadlineBlocks(blocks);
  if (deadlineBlocks.length === 0) return [];
  const response = parseResponse(input.jsonResponse);
  const out: DeadlineConfig[] = [];
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
    if (d) {
      out.push({
        date: d,
        blockId: b.id,
        resetTriggers: b.attributes?.resetTriggers,
      });
    }
  }
  return out;
}

type EventLike = {
  kind: string;
  occurredAt: Date | string;
  metadata?: unknown;
};

function intersects(a?: string[], b?: unknown): boolean {
  if (!a || a.length === 0) return false;
  if (Array.isArray(b)) return a.some((x) => (b as unknown[]).includes(x));
  if (typeof b === "string") return a.includes(b);
  return false;
}

function includesValue(arr?: string[], val?: unknown): boolean {
  if (!arr || arr.length === 0 || typeof val !== "string") return false;
  return arr.includes(val);
}

/**
 * Verifica se algum dos triggers configurados foi satisfeito por eventos
 * que aconteceram APÓS a criação da resposta do formulário. Lógica OR:
 * primeiro trigger satisfeito → cumprido.
 *
 *   - status_changed → bate se `metadata.newStatusId` ∈ statusIds OU
 *     `metadata.newTrackingId` ∈ trackingIds.
 *   - tag_added → bate se interseção (`metadata.tagIds[]` OU
 *     `metadata.tagId`) ∩ tagIds não-vazia.
 *   - form_submit → bate se `metadata.formId` ∈ formIds.
 *   - Próximo grupo → lê `jsonResponse.__groupsReached.meta.groups` (escrito
 *     pelo FormSubmitComponent on-step-advance). Se interseção com
 *     `nextGroupIds` não-vazia → cumprido.
 */
export function isDeadlineFulfilled(input: {
  resetTriggers?: ResetTriggers;
  leadEvents: EventLike[];
  formCreatedAt: Date | string;
  jsonResponse: unknown;
}): boolean {
  const t = input.resetTriggers;
  if (!t) return false;
  const hasAnyConfig =
    !!t.trackingIds?.length ||
    !!t.statusIds?.length ||
    !!t.tagIds?.length ||
    !!t.formIds?.length ||
    !!t.nextGroupIds?.length;
  if (!hasAnyConfig) return false;

  // Trigger "Próximo grupo" — lê marker do jsonResponse, não depende de
  // LeadJourneyEvent (é um sinal interno do form fill).
  if (t.nextGroupIds && t.nextGroupIds.length > 0) {
    const resp = parseResponse(input.jsonResponse);
    const marker = resp["__groupsReached"] as
      | { meta?: { groups?: unknown } }
      | undefined;
    const groups = marker?.meta?.groups;
    if (intersects(t.nextGroupIds, groups)) return true;
  }

  const formAt =
    typeof input.formCreatedAt === "string"
      ? new Date(input.formCreatedAt).getTime()
      : input.formCreatedAt.getTime();

  for (const evt of input.leadEvents) {
    const evtAt =
      typeof evt.occurredAt === "string"
        ? new Date(evt.occurredAt).getTime()
        : evt.occurredAt.getTime();
    if (evtAt <= formAt) continue;
    const meta = (evt.metadata ?? {}) as Record<string, unknown>;
    if (evt.kind === "status_changed") {
      if (includesValue(t.statusIds, meta.newStatusId)) return true;
      if (includesValue(t.trackingIds, meta.newTrackingId)) return true;
    } else if (evt.kind === "tag_added") {
      // metadata pode trazer `tagId` (singular) ou `tagIds` (array)
      if (intersects(t.tagIds, meta.tagIds)) return true;
      if (includesValue(t.tagIds, meta.tagId)) return true;
    } else if (evt.kind === "form_submit") {
      if (includesValue(t.formIds, meta.formId)) return true;
    }
  }

  return false;
}

/**
 * Tier de criticidade do prazo, usado pra escolher a cor do badge.
 *  - `safe`     → verde   (≥ 3 dias restantes)
 *  - `warning`  → amarelo (entre 24h e 3 dias)
 *  - `urgent`   → laranja (≤ 24h restantes — "no mesmo dia")
 *  - `expired`  → vermelho (passou da data)
 *
 * Threshold em horas: 24h (urgent) e 72h (warning) — define duas
 * fronteiras a partir do "tempo restante", coerente com a regra de
 * negócio (verde 3d+ / amarelo ≤3d / laranja ≤24h / vermelho atrasado).
 */
export type DeadlineTier = "safe" | "warning" | "urgent" | "expired";

export function getDeadlineTier(deadline: Date | null): DeadlineTier | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs < 0) return "expired";
  const hours = diffMs / (1000 * 60 * 60);
  if (hours <= 24) return "urgent";
  if (hours < 24 * 3) return "warning";
  return "safe";
}

type FormatOptions = {
  /**
   * `compact: true` devolve string CURTA pra cards apertados (kanban):
   *   - >=1d: "Xd Yh"  (sem minutos)
   *   - <1d:  "Hh Mm"  (sem segundos)
   *   - expired: "-Xd Yh" ou "-Hh"  (curto)
   * `compact: false` (default) devolve string COMPLETA com prefixo
   * "Faltam"/"Atrasado" pra UIs com mais espaço (lead-form-responses).
   */
  compact?: boolean;
};

/**
 * Formata o tempo restante até `deadline`. Pode devolver formato longo
 * ("Faltam 02d 14h 03m") ou compacto ("2d 14h") via `opts.compact`.
 * Tier de criticidade vem junto pra UI decidir cor.
 */
export function formatTimeUntil(
  deadline: Date | null,
  opts: FormatOptions = {},
): {
  label: string;
  expired: boolean;
  tier: DeadlineTier;
} | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const dd = Math.floor(absMs / (1000 * 60 * 60 * 24));
  const hh = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mm = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
  const ss = Math.floor((absMs % (1000 * 60)) / 1000);
  const tier = (getDeadlineTier(deadline) ?? "safe") as DeadlineTier;

  if (opts.compact) {
    // Formato curto: max ~6 chars sem prefixo. Cabe em qualquer card.
    let core: string;
    if (dd > 0) {
      // "2d 14h" — sem minutos pra economizar espaço
      core = `${dd}d ${hh}h`;
    } else if (hh > 0) {
      // "14h 03m"
      core = `${hh}h ${String(mm).padStart(2, "0")}m`;
    } else {
      // <1h: "59m" (sem segundos no compacto pra reduzir tick visual)
      core = `${mm}m`;
    }
    return {
      label: diffMs < 0 ? `-${core}` : core,
      expired: diffMs < 0,
      tier,
    };
  }

  // Formato longo com prefixo
  let core: string;
  if (dd > 0) {
    core = `${dd}d ${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m`;
  } else {
    core = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return {
    label: diffMs < 0 ? `Atrasado ${core}` : `Faltam ${core}`,
    expired: diffMs < 0,
    tier,
  };
}
