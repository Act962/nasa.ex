/**
 * Extrai a mensagem de um erro de procedure para mostrar no toast.
 *
 * Antes, todo catch do financeiro descartava o erro e mostrava um texto fixo
 * ("Erro ao criar lançamento"). Quando a procedure recusava por um motivo
 * concreto — sem permissão, conta de outra organização, valor fora do limite
 * de aprovação — esse motivo se perdia e o usuário só via que "deu erro".
 *
 * O fallback continua existindo: erro sem mensagem útil (falha de rede, 500
 * inesperado) não deve despejar stack trace na tela.
 */

// Mensagens que o oRPC/fetch devolve por padrão e que não dizem nada a quem lê.
const UNHELPFUL_MESSAGES = new Set([
  "Something went wrong",
  "Internal server error",
  "Internal Server Error",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Load failed",
]);

export function describePaymentError(error: unknown, fallback: string): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const trimmed = message.trim();
  if (!trimmed || UNHELPFUL_MESSAGES.has(trimmed)) return fallback;
  return trimmed;
}
