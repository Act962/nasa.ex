/**
 * Rate-limit em memória por chave arbitrária (geralmente IP, email, ou
 * IP+email). Sem deps externas — usa Map + cleanup periódico.
 *
 * Usado pra anti-spam em:
 *  - submitClaim (max 3 reivindicações/IP/dia)
 *  - submitReport (max 5 denúncias/IP/dia)
 *
 * Limitação: in-memory == per-process. Em ambientes com múltiplos
 * processos (Vercel serverless), cada instância tem seu próprio
 * contador — limite real pode ser N x configured. Aceitável pra MVP;
 * upgrade pra Redis no futuro se virar problema real.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Cleanup periódico de entradas expiradas pra não vazar memória.
// Rodado a cada N hits (lazy) — evita setInterval que iria vazar
// processo serverless.
let hitsSinceCleanup = 0;
const CLEANUP_EVERY_N_HITS = 100;

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Verifica e incrementa o counter pra `key`. Permite até `limit` hits
 * dentro da janela `windowMs`. Retorna `allowed=false` quando exceder.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  hitsSinceCleanup++;
  if (hitsSinceCleanup >= CLEANUP_EVERY_N_HITS) {
    hitsSinceCleanup = 0;
    cleanup();
  }

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Primeira ocorrência ou janela expirada — reseta.
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/** 24h em ms. Janela padrão pra os limits de calendário. */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
