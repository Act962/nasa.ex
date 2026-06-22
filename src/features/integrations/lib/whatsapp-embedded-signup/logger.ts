import "server-only";

/**
 * Logger estruturado do Embedded Signup (Fase 7.5).
 *
 * Eventos saem como JSON em `console.log` com prefixo `[embedded-signup]`
 * pra serem facilmente filtrados pelo agregador de logs (Coolify/Sentry/
 * Datadog conforme a infra de prod). NÃO incluir segredo nenhum no body —
 * mesmo `last4` cabe só em log de auditoria explícita (`logActivity`).
 */

export type EmbeddedSignupEvent =
  | "code_received"
  | "token_exchanged"
  | "subscribed"
  | "registered"
  | "phone_validated"
  | "completed"
  | "failed";

interface EmbeddedSignupLogContext {
  event: EmbeddedSignupEvent;
  trackingId: string;
  organizationId?: string;
  wabaId?: string;
  phoneNumberId?: string;
  /** Total ms decorridos desde `code_received`. Só preenchido em events tardios. */
  elapsedMs?: number;
  /** `fbtrace_id` da Graph API quando vem em erro. */
  fbtraceId?: string;
  /** Subtipo de erro (`token_exchange_failed`, `subscribe_failed`, etc). */
  failureKind?: string;
  /** Detalhe textual curto. NÃO incluir segredos. */
  detail?: string;
}

export function logEmbeddedSignup(context: EmbeddedSignupLogContext): void {
  const level = context.event === "failed" ? "error" : "info";
  const payload = {
    scope: "embedded-signup",
    level,
    ...context,
    at: new Date().toISOString(),
  };
  if (level === "error") {
    console.error("[embedded-signup]", payload);
  } else {
    console.log("[embedded-signup]", payload);
  }
}

/**
 * Rate-limit in-process: 3 onboardings de Embedded Signup por org por hora.
 *
 * Defesa contra:
 *  - Cliente repetir clicks no botão por instabilidade visual (UI desabilita
 *    durante a mutation, mas networking flaky pode produzir múltiplas).
 *  - Ataque interno (admin malicioso) que tentaria invocar a procedure em
 *    loop pra esgotar quota da Graph API ou enviar SPAM de PIN.
 *
 * Cabe in-process porque:
 *  - O volume esperado é trivial (poucos onboardings por org por mês na
 *    fase de adoção).
 *  - Multi-instância tolerável: cada processo conta sua janela; nas piores
 *    condições, N processos = N × 3 onboardings/h, ainda longe de qualquer
 *    quota Meta.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 3;
const MAX_TRACKED_ORGS = 5_000;

interface OrgWindow {
  timestamps: number[];
}

const orgWindows = new Map<string, OrgWindow>();

export function checkEmbeddedSignupRateLimit(organizationId: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const entry = orgWindows.get(organizationId);
  const validTimestamps = entry
    ? entry.timestamps.filter((ts) => now - ts < ONE_HOUR_MS)
    : [];

  if (validTimestamps.length >= MAX_PER_HOUR) {
    const oldest = validTimestamps[0];
    return {
      allowed: false,
      retryAfterMs: Math.max(0, ONE_HOUR_MS - (now - oldest)),
    };
  }

  validTimestamps.push(now);
  orgWindows.set(organizationId, { timestamps: validTimestamps });

  // Sweep defensivo: se o map cresceu além do cap, descarta entries
  // antigas (FIFO pela ordem de inserção do Map).
  if (orgWindows.size > MAX_TRACKED_ORGS) {
    for (const key of orgWindows.keys()) {
      orgWindows.delete(key);
      if (orgWindows.size <= MAX_TRACKED_ORGS) break;
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}
