import "server-only";

import type { ResolvedModel } from "./resolve-model";

/**
 * Executa a tarefa no primeiro modelo e avança para o próximo só quando a falha
 * é de disponibilidade — indisponibilidade, limite de taxa, cota.
 *
 * Erro de validação ou de conteúdo NÃO avança: tentar de novo em outro provedor
 * gastaria dinheiro para receber a mesma recusa.
 *
 * Vale só para chamadas não-streaming. Em resposta transmitida o erro aparece
 * depois dos cabeçalhos já terem sido enviados, e trocar de provedor no meio
 * não é possível — ver docs/BILLING_ARCHITECTURE.md §4.5.
 */

const RETRYABLE_PATTERNS = [
  "rate limit",
  "rate_limit",
  "overloaded",
  "capacity",
  "quota",
  "unavailable",
  "timeout",
  "503",
  "529",
];

export function isAvailabilityError(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

export interface FallbackAttempt {
  resolved: ResolvedModel;
  error: unknown;
}

export interface FallbackResult<T> {
  value: T;
  used: ResolvedModel;
  /** Tentativas que falharam antes. Cada uma custou dinheiro e é registrada. */
  failed: FallbackAttempt[];
}

export async function runWithFallback<T>(
  candidates: ResolvedModel[],
  run: (resolved: ResolvedModel) => Promise<T>,
): Promise<FallbackResult<T>> {
  if (candidates.length === 0) {
    throw new Error("Nenhum modelo disponível para executar a tarefa.");
  }

  const failed: FallbackAttempt[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      const value = await run(candidate);
      return { value, used: candidate, failed };
    } catch (error) {
      const isLast = index === candidates.length - 1;
      if (isLast || !isAvailabilityError(error)) throw error;

      failed.push({ resolved: candidate, error });
      console.warn(
        `[ia/router] ${candidate.provider}/${candidate.modelId} indisponível, ` +
          `tentando o próximo candidato.`,
      );
    }
  }

  // Inalcançável: o laço ou retorna ou lança na última tentativa.
  throw new Error("Nenhum modelo disponível para executar a tarefa.");
}
