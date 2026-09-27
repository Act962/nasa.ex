import type { AstroQaSession, AstroReply } from "../astro-session";
import type { QaOrgContext } from "../qa-org";

export type Complexity = "N1" | "N2" | "N3";

export interface QaCaseContext {
  qaOrg: QaOrgContext;
  /** Conversa nova para o caso; cada repetição ganha a sua. */
  session: AstroQaSession;
  /** Momento em que o caso começou — base das datas relativas. */
  startedAt: Date;
}

export interface QaCase {
  /** Mesmo id do documento (docs/astro-bateria-de-testes.md). */
  id: string;
  complexity: Complexity;
  title: string;
  run: (context: QaCaseContext) => Promise<void>;
  /** Desfaz o que o caso criou, para a próxima repetição começar igual. */
  cleanup?: (context: QaCaseContext) => Promise<void>;
}

export interface QaPhase {
  id: string;
  title: string;
  cases: QaCase[];
  /** Casos do documento ainda sem automação. Travam o portão da fase. */
  pendingCaseIds: string[];
}

export class QaAssertionError extends Error {}

export function expectThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new QaAssertionError(message);
}

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** O texto da resposta contém todos os trechos (sem acento, sem caixa). */
export function expectReplyContains(reply: AstroReply, fragments: (string | number)[]): void {
  const replyText = normalizeForMatch(reply.text);
  const missing = fragments.filter(
    (fragment) => !replyText.includes(normalizeForMatch(String(fragment))),
  );
  expectThat(
    missing.length === 0,
    `Resposta sem ${missing.map((fragment) => `"${fragment}"`).join(", ")}. Veio (${reply.layer}${reply.key ? ` ${reply.key}` : ""}): ${reply.text.slice(0, 300)}`,
  );
}

/** Opções do cartão de escolha, quando houver. */
export function replyOptionLabels(reply: AstroReply): string[] {
  return reply.actionResult?.status === "ambiguous"
    ? reply.actionResult.options.map((option) => option.label)
    : [];
}

export function describeReply(reply: AstroReply): string {
  const options = replyOptionLabels(reply);
  return `[${reply.layer}${reply.key ? ` ${reply.key}` : ""}${reply.actionResult ? ` ${reply.actionResult.status}` : ""}] ${reply.text.slice(0, 240)}${options.length ? ` | opções: ${options.join(", ")}` : ""}`;
}
