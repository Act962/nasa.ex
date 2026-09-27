/** Normalização e checagem de domínios permitidos do ASTRO CHAT (TR-1). */

export function normalizeOrigin(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function withoutWww(origin: string): string {
  return origin.replace("://www.", "://");
}

/** `https://exemplo.com` cadastrado também libera `https://www.exemplo.com` e vice-versa. */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const bare = withoutWww(normalized);
  return allowedOrigins.some((allowed) => withoutWww(allowed) === bare);
}
