// Como o cliente entra num Fluxo de Atendimento (spec 0139, RF-4/RF-5). Sem `server-only`: o editor usa as mesmas regras.

export const ATTENDANCE_ENTRY_MODES = ["WELCOME", "KEYWORD", "DEFAULT", "BROADCAST"] as const;
export type AttendanceEntryMode = (typeof ATTENDANCE_ENTRY_MODES)[number];

export const ATTENDANCE_ENTRY_LABELS: Record<AttendanceEntryMode, string> = {
  WELCOME: "Boas-vindas (primeira mensagem do contato)",
  KEYWORD: "Palavra-chave",
  DEFAULT: "Resposta padrão (nenhuma outra regra pegou)",
  BROADCAST: "Só por disparo",
};

export type KeywordMatchMode = "EXACT" | "CONTAINS";

export interface AttendanceEntry {
  mode: AttendanceEntryMode;
  keywords: string[];
  matchMode: KeywordMatchMode;
}

type Fields = Record<string, unknown>;

function asFields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

/** Sem acento, maiúscula, pontuação e espaço sobrando: "Olá,  Mundo!" e "ola mundo" são as mesmas palavras. */
export function normalizeKeywordText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function parseAttendanceEntry(data: unknown): AttendanceEntry {
  const fields = asFields(data);
  const mode = ATTENDANCE_ENTRY_MODES.includes(fields.mode as AttendanceEntryMode) ? (fields.mode as AttendanceEntryMode) : "DEFAULT";
  const keywords = Array.isArray(fields.keywords)
    ? [...new Set((fields.keywords as unknown[]).map((keyword) => normalizeKeywordText(String(keyword ?? ""))).filter(Boolean))]
    : [];
  return { mode, keywords, matchMode: fields.matchMode === "EXACT" ? "EXACT" : "CONTAINS" };
}

export function matchesKeyword(entry: AttendanceEntry, messageText: string): boolean {
  if (entry.mode !== "KEYWORD" || entry.keywords.length === 0) return false;
  const text = normalizeKeywordText(messageText);
  if (!text) return false;
  if (entry.matchMode === "EXACT") return entry.keywords.includes(text);
  const paddedText = ` ${text} `;
  return entry.keywords.some((keyword) => paddedText.includes(` ${keyword} `));
}

export interface ActiveEntryOfFlow {
  workflowId: string;
  workflowName: string;
  entry: AttendanceEntry;
}

/**
 * Conflito de entrada entre fluxos ativos do mesmo número (RF-5): um só de Boas-vindas, um só de Resposta padrão e
 * nenhuma palavra-chave repetida. Devolve a frase para o usuário, ou `null` quando está tudo certo.
 */
export function findEntryConflict(candidate: ActiveEntryOfFlow, others: ActiveEntryOfFlow[]): string | null {
  const rivals = others.filter((other) => other.workflowId !== candidate.workflowId);
  if (candidate.entry.mode === "WELCOME" || candidate.entry.mode === "DEFAULT") {
    const rival = rivals.find((other) => other.entry.mode === candidate.entry.mode);
    if (rival) {
      const what = candidate.entry.mode === "WELCOME" ? "Boas-vindas" : "Resposta padrão";
      return `O fluxo "${rival.workflowName}" já é o de ${what} deste número. Desative-o antes.`;
    }
  }
  if (candidate.entry.mode === "KEYWORD") {
    if (candidate.entry.keywords.length === 0) return "Informe pelo menos uma palavra-chave no bloco Início.";
    for (const rival of rivals) {
      if (rival.entry.mode !== "KEYWORD") continue;
      const repeated = candidate.entry.keywords.find((keyword) => rival.entry.keywords.includes(keyword));
      if (repeated) return `A palavra-chave "${repeated}" já está no fluxo "${rival.workflowName}".`;
    }
  }
  return null;
}

/** Qual fluxo pega a mensagem, na ordem do RF-6: palavra-chave, boas-vindas, resposta padrão. */
export function pickEntryFlow(params: {
  flows: ActiveEntryOfFlow[];
  messageText: string;
  isFirstInbound: boolean;
}): ActiveEntryOfFlow | null {
  const byKeyword = params.flows.find((flow) => matchesKeyword(flow.entry, params.messageText));
  if (byKeyword) return byKeyword;
  if (params.isFirstInbound) {
    const welcome = params.flows.find((flow) => flow.entry.mode === "WELCOME");
    if (welcome) return welcome;
  }
  return params.flows.find((flow) => flow.entry.mode === "DEFAULT") ?? null;
}
