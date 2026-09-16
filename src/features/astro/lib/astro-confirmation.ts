/**
 * Payloads de confirmação do Astro (spec 0014, D-2).
 *
 * Uma tool `propose_*` devolve `astro_confirmation`; o cliente renderiza um
 * card com "Confirmar"/"Cancelar" que envia a resposta como mensagem, e o
 * WhatsApp resume em texto + botões. `confirm_action` devolve
 * `astro_confirmation_result`. Sem `server-only`: o renderer importa daqui.
 */

export interface AstroConfirmationLine {
  label: string;
  value: string;
}

export interface AstroConfirmationPayload {
  kind: "astro_confirmation";
  proposalId: string;
  actionType: string;
  title: string;
  lines: AstroConfirmationLine[];
  warnings: string[];
  /** ISO. Depois disso o `confirm_action` recusa. */
  expiresAt: string;
  /** Frase pronta pra confirmar por texto (chat e WhatsApp). */
  confirmHint: string;
}

export interface AstroConfirmationResultPayload {
  kind: "astro_confirmation_result";
  proposalId: string;
  actionType: string;
  ok: boolean;
  title: string;
  summary: string;
  lines?: AstroConfirmationLine[];
  links?: Array<{ label: string; href: string }>;
}

export function isAstroConfirmationPayload(value: unknown): value is AstroConfirmationPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_confirmation" &&
    typeof (value as { proposalId?: unknown }).proposalId === "string" &&
    Array.isArray((value as { lines?: unknown }).lines)
  );
}

export function isAstroConfirmationResultPayload(
  value: unknown,
): value is AstroConfirmationResultPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_confirmation_result" &&
    typeof (value as { proposalId?: unknown }).proposalId === "string"
  );
}

/** Texto que o botão "Confirmar" envia — o orquestrador mapeia pra `confirm_action`. */
export function buildConfirmMessage(proposalId: string): string {
  return `confirmar ${proposalId}`;
}

export function buildCancelMessage(proposalId: string): string {
  return `cancelar ${proposalId}`;
}
