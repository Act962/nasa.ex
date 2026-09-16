// Contrato de falha dos serviços de conciliação: o handler oRPC traduz em
// NOT_FOUND/BAD_REQUEST e a tool do Astro devolve `message` ao modelo.

export type StatementFailureReason =
  | "not_found"
  | "invalid"
  | "account_mismatch"
  | "unsupported"
  | "too_many_transactions"
  | "no_api_key"
  | "model_failed"
  | "insufficient_stars";

export interface StatementFailure {
  ok: false;
  reason: StatementFailureReason;
  message: string;
}

export function statementFailure(
  reason: StatementFailureReason,
  message: string,
): StatementFailure {
  return { ok: false, reason, message };
}

export interface StatementActor {
  id: string;
  name: string;
  email: string;
}
