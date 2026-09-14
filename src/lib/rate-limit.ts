/**
 * Limitador simples por chave (IP, telefone…) em memória — o mesmo padrão do
 * chat público de agendamento. Suficiente para frear abuso em instância única;
 * multi-instância pede Redis/KV. Singleton via globalThis para sobreviver ao
 * hot-reload do Next.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  __nasaRateLimitBuckets?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> =
  globalForRateLimit.__nasaRateLimitBuckets ??
  (globalForRateLimit.__nasaRateLimitBuckets = new Map());

function collectGarbage(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function takeRateLimit(
  scope: string,
  key: string,
  options: { max: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  collectGarbage(now);
  const bucketKey = `${scope}:${key}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= options.max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}
