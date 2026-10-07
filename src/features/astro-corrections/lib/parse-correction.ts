// Leitura do "errou" (spec 0073). Só vale a MENSAGEM INTEIRA: "errou" no meio
// de uma frase é assunto do usuário, não aviso para o ASTRO.

export type CorrectionMessage =
  | { kind: "report"; expected: string | null }
  | { kind: "skip" }
  | { kind: "other" };

const REPORT_WORDS =
  "errou|errado|errada|t[aá] errado|est[aá] errado|voc[eê] errou|vc errou|n[aã]o era isso|n[aã]o foi isso|n[aã]o [eé] isso|resposta errada";
const REPORT_ONLY = new RegExp(`^(?:${REPORT_WORDS}|👎)[\\s.!]*$`, "iu");
const REPORT_WITH_EXPECTED = new RegExp(`^(?:${REPORT_WORDS}|👎)\\s*[:,;.!\\-–—]+\\s*([\\s\\S]{3,})$`, "iu");
const SKIP_ONLY = /^(?:pular|pula|pulo|deixa|deixa pra l[aá]|n[aã]o sei|nada)[\s.!]*$/iu;

export function parseCorrectionMessage(text: string): CorrectionMessage {
  const trimmed = text.trim();
  if (REPORT_ONLY.test(trimmed)) return { kind: "report", expected: null };
  const expected = trimmed.match(REPORT_WITH_EXPECTED)?.[1]?.trim();
  if (expected) return { kind: "report", expected };
  if (SKIP_ONLY.test(trimmed)) return { kind: "skip" };
  return { kind: "other" };
}

export const CORRECTION_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export interface CorrectionTurn {
  user: string;
  astro: string;
  at: string;
}
