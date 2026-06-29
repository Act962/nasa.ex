/**
 * Classifica erros vindos do SDK `ai` (`generateText`/`streamText`) +
 * underlying providers (OpenAI, Anthropic, Google). Converte mensagens
 * opacas em códigos estáveis + texto PT-BR pro user entender o que fazer.
 *
 * Códigos suportados:
 *   - QUOTA_EXCEEDED     — chave/conta sem crédito
 *   - RATE_LIMITED       — muitos requests / TPM/RPM excedido
 *   - INVALID_KEY        — chave inválida ou revogada
 *   - INVALID_REQUEST    — prompt mal-formado, tokens demais, modelo errado
 *   - TIMEOUT            — request demorou demais
 *   - SERVER_ERROR       — provider 5xx
 *   - UNKNOWN            — qualquer outra coisa
 *
 * Cada código vem com:
 *   - `code`       — identificador estável pra logging/dashboards
 *   - `message`    — texto curto PT-BR pra mostrar no UI
 *   - `recoverable`— true = transiente (retry pode resolver), false = ação humana
 *   - `actionHint` — opcional, sugere o que o user faz
 */

export type AiErrorCode =
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "INVALID_KEY"
  | "INVALID_REQUEST"
  | "TIMEOUT"
  | "SERVER_ERROR"
  | "UNKNOWN";

export interface ParsedAiError {
  code: AiErrorCode;
  message: string;
  recoverable: boolean;
  actionHint?: string;
  /** Texto bruto do erro pra debug — não mostrado em UI normalmente. */
  rawMessage: string;
}

/**
 * Heurística por substring — o SDK `ai` propaga `error.message` que
 * geralmente carrega texto descritivo do provider (ex: "insufficient_quota",
 * "rate limit reached", "invalid_api_key"). Status code HTTP também é
 * exposto em alguns providers (`error.statusCode` / `error.cause.status`).
 */
export function parseAiError(err: unknown): ParsedAiError {
  const rawMessage = extractMessage(err);
  const lowered = rawMessage.toLowerCase();
  const statusCode = extractStatusCode(err);

  // ── QUOTA_EXCEEDED ────────────────────────────────────────────────
  // OpenAI: "insufficient_quota", "You exceeded your current quota"
  // Anthropic: "credit_balance_too_low"
  // Google: "RESOURCE_EXHAUSTED"
  if (
    lowered.includes("insufficient_quota") ||
    lowered.includes("exceeded your current quota") ||
    lowered.includes("credit_balance_too_low") ||
    lowered.includes("resource_exhausted") ||
    lowered.includes("billing")
  ) {
    return {
      code: "QUOTA_EXCEEDED",
      message:
        "Conta sem crédito no provider de IA. Adicione saldo ou revise o plano.",
      recoverable: false,
      actionHint:
        "Acesse o dashboard do OpenAI/Anthropic/Google pra recarregar a chave.",
      rawMessage,
    };
  }

  // ── RATE_LIMITED ──────────────────────────────────────────────────
  // OpenAI: status 429 + "Rate limit reached"
  // Anthropic: 429 + "rate_limit_error"
  if (
    statusCode === 429 ||
    lowered.includes("rate limit") ||
    lowered.includes("rate_limit") ||
    lowered.includes("too many requests")
  ) {
    return {
      code: "RATE_LIMITED",
      message:
        "Provider IA bloqueou temporariamente por excesso de requests.",
      recoverable: true,
      actionHint:
        "Aguarde 1-2 min e tente de novo. Se persistir, distribua workflows ao longo do dia.",
      rawMessage,
    };
  }

  // ── INVALID_KEY ───────────────────────────────────────────────────
  // OpenAI: 401 + "Incorrect API key" / "invalid_api_key"
  // Anthropic: "authentication_error"
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lowered.includes("invalid_api_key") ||
    lowered.includes("incorrect api key") ||
    lowered.includes("authentication_error") ||
    lowered.includes("api key not valid")
  ) {
    return {
      code: "INVALID_KEY",
      message:
        "Chave de API inválida ou revogada. IA não consegue autenticar.",
      recoverable: false,
      actionHint:
        "Verifique a env OPENAI_API_KEY ou a chave custom em Tracking → Configurações → Chatbot IA.",
      rawMessage,
    };
  }

  // ── INVALID_REQUEST ───────────────────────────────────────────────
  // 400 — prompt longo demais, modelo não existe, schema errado
  if (
    statusCode === 400 ||
    statusCode === 404 ||
    lowered.includes("invalid_request") ||
    lowered.includes("context length") ||
    lowered.includes("maximum context") ||
    lowered.includes("model not found")
  ) {
    return {
      code: "INVALID_REQUEST",
      message: "Request inválida ao provider IA (modelo/prompt).",
      recoverable: false,
      actionHint:
        "Veja se o modelo configurado existe e se o prompt não passa do limite de contexto.",
      rawMessage,
    };
  }

  // ── TIMEOUT ───────────────────────────────────────────────────────
  if (
    lowered.includes("timeout") ||
    lowered.includes("timed out") ||
    lowered.includes("etimedout") ||
    lowered.includes("aborted")
  ) {
    return {
      code: "TIMEOUT",
      message: "Provider IA demorou demais pra responder.",
      recoverable: true,
      actionHint:
        "Geralmente passa. Se persistir, considere modelo mais rápido (ex: gpt-4o-mini).",
      rawMessage,
    };
  }

  // ── SERVER_ERROR ──────────────────────────────────────────────────
  if (
    (statusCode !== null && statusCode >= 500 && statusCode < 600) ||
    lowered.includes("internal server error") ||
    lowered.includes("service unavailable") ||
    lowered.includes("bad gateway")
  ) {
    return {
      code: "SERVER_ERROR",
      message: "Provider IA está fora do ar temporariamente.",
      recoverable: true,
      actionHint: "Aguarde alguns minutos — geralmente resolve sozinho.",
      rawMessage,
    };
  }

  // ── UNKNOWN ──────────────────────────────────────────────────────
  return {
    code: "UNKNOWN",
    message: "Falha desconhecida ao chamar IA.",
    recoverable: false,
    rawMessage,
  };
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { message?: string; error?: { message?: string } };
    return e.message ?? e.error?.message ?? JSON.stringify(err).slice(0, 500);
  }
  return String(err);
}

function extractStatusCode(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    statusCode?: number;
    status?: number;
    cause?: { status?: number; statusCode?: number };
  };
  return (
    e.statusCode ?? e.status ?? e.cause?.statusCode ?? e.cause?.status ?? null
  );
}
