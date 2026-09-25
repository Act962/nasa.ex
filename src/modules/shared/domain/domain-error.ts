/**
 * Erro de domínio — carrega um `code` estável que o adapter primário traduz
 * para o protocolo dele (ORPCError, status HTTP). O domínio não conhece HTTP.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
