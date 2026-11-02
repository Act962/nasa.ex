import "server-only";

/**
 * Cache de leitura da Meta (spec 0122, RNF-2). Só economiza chamadas: com duas
 * instâncias ou depois de um restart, cada uma busca de novo e o número é o mesmo.
 * A Meta atualiza os insights a cada 15 min, então mais que isso não ganha nada.
 */

const MAX_ENTRIES = 500;
export const META_READ_CACHE_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;

type CacheEntry = { value?: unknown; error?: unknown; expiresAt: number };

const globalForCache = globalThis as unknown as { __trafegoMetaReadCache?: Map<string, CacheEntry> };
const cache = globalForCache.__trafegoMetaReadCache ?? new Map<string, CacheEntry>();
globalForCache.__trafegoMetaReadCache = cache;

function rememberEntry(key: string, entry: CacheEntry) {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, entry);
}

/** Chave estável: conta + bloco + período + filtro. O período sempre entra (CA-6). */
export function buildMetaReadCacheKey(parts: Record<string, string | number | null | undefined>): string {
  return Object.keys(parts)
    .sort()
    .map((partName) => `${partName}=${parts[partName] ?? ""}`)
    .join("|");
}

export async function readThroughMetaCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    if ("error" in cached) throw cached.error;
    return cached.value as T;
  }
  try {
    const value = await loader();
    rememberEntry(key, { value, expiresAt: Date.now() + META_READ_CACHE_TTL_MS });
    return value;
  } catch (loadError) {
    rememberEntry(key, { error: loadError, expiresAt: Date.now() + FAILURE_TTL_MS });
    throw loadError;
  }
}

/** Depois de uma escrita (pausar, ativar), as leituras da org não podem mostrar o estado antigo. */
export function forgetMetaReadCacheForOrg(organizationId: string) {
  const orgPart = `org=${organizationId}`;
  for (const key of [...cache.keys()]) {
    if (key.split("|").includes(orgPart)) cache.delete(key);
  }
}
