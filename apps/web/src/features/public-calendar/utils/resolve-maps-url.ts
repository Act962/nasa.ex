/**
 * Resolve uma URL do Google Maps em `{ city, state }` usando Nominatim
 * (OpenStreetMap). Server-side only — Nominatim exige User-Agent
 * customizado e rate-limit de 1 req/s.
 *
 * Suporta 3 formatos de URL:
 *   1. Short link (`maps.app.goo.gl/...`, `goo.gl/maps/...`) → segue
 *      o redirect pra pegar a URL longa, daí parse.
 *   2. URL longa com `/place/<nome>` → usa o nome no Nominatim search.
 *   3. URL longa com `@lat,lng,zoom` → reverse geocode pelas coordenadas.
 *
 * Fallback: se nenhum desses casos resolver, retorna `null` (UI mantém
 * city/state vazios e o user preenche na mão).
 */

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "NASA-SpaceStation/1.0 (contato@nasaagents.com)";

// Cache em memória (process-local). Mesmo dado de geocode, expira em 30
// dias. URLs do Maps tendem a ser estáveis (não mudam), então cache aqui
// economiza muitas chamadas ao Nominatim.
type CacheEntry = { city: string | null; state: string | null; at: number };
const cache = new Map<string, CacheEntry>();
const TTL = 1000 * 60 * 60 * 24 * 30;

const SHORT_HOSTS = ["goo.gl", "maps.app.goo.gl"];

export type ResolvedMapsLocation = {
  city: string | null;
  state: string | null;
};

function isShortUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return SHORT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

/**
 * Segue redirect de short link. `redirect: "manual"` pra capturar
 * Location header sem o fetch nativo seguir automaticamente — assim
 * pegamos a URL final mesmo se for cross-origin (Google bloqueia
 * follow direto em alguns casos).
 */
async function followShortUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
    });
    const location = res.headers.get("location");
    if (location) return location;
    // Fallback: alguns short links só revelam o destino via GET
    const res2 = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
    });
    return res2.headers.get("location");
  } catch {
    return null;
  }
}

/**
 * Extrai informação útil da URL longa do Google Maps. Retorna `null`
 * se não conseguir identificar nada parseável.
 */
function extractFromLongUrl(
  longUrl: string,
): { type: "name"; value: string } | { type: "coords"; lat: number; lng: number } | null {
  try {
    const u = new URL(longUrl);

    // 1. `/place/<encoded_name>/@lat,lng,zoom/...` — pega `name` primeiro
    const placeMatch = u.pathname.match(/\/place\/([^/]+)/);
    if (placeMatch) {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      if (decoded.trim()) return { type: "name", value: decoded };
    }

    // 2. `?q=<query>` — busca textual no maps
    const q = u.searchParams.get("q");
    if (q) {
      // Se o q é coordenada "lat,lng", parsea como coords
      const coordMatch = q.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      if (coordMatch) {
        return {
          type: "coords",
          lat: parseFloat(coordMatch[1]),
          lng: parseFloat(coordMatch[2]),
        };
      }
      return { type: "name", value: q };
    }

    // 3. `@lat,lng,zoom` na URL — reverse geocode pelas coordenadas
    const atMatch = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      return {
        type: "coords",
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Nominatim search forward — recebe um texto e devolve city/state.
 * Filtra por país BR pra evitar matches incorretos em cidades homônimas.
 */
async function nominatimSearch(query: string): Promise<ResolvedMapsLocation | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        state_code?: string;
      };
    }>;
    if (!json[0]?.address) return null;
    return normalizeNominatimAddress(json[0].address);
  } catch {
    return null;
  }
}

/**
 * Nominatim reverse — recebe coordenadas e devolve city/state.
 */
async function nominatimReverse(
  lat: number,
  lng: number,
): Promise<ResolvedMapsLocation | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        state_code?: string;
      };
    };
    if (!json.address) return null;
    return normalizeNominatimAddress(json.address);
  } catch {
    return null;
  }
}

/**
 * Nominatim pode retornar city em `city`, `town`, `village` ou
 * `municipality` — depende do tipo de divisão administrativa. Pegamos
 * o primeiro disponível na ordem mais comum.
 *
 * State vem como nome completo ("São Paulo") ou código ISO ("SP" via
 * `state_code`). Preferimos o código se disponível pra compatibilidade
 * com os selects de UF.
 */
function normalizeNominatimAddress(addr: {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  state_code?: string;
}): ResolvedMapsLocation {
  const city =
    addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;
  let state: string | null = null;
  if (addr.state_code) {
    // Vem como "BR-SP" no padrão ISO 3166-2. Pega só "SP".
    state = addr.state_code.replace(/^BR-/i, "").toUpperCase();
  } else if (addr.state) {
    state = addr.state;
  }
  return { city, state };
}

/**
 * Função principal. Recebe a URL (qualquer formato Google Maps),
 * resolve, retorna `{ city, state }` ou `null`.
 */
export async function resolveMapsUrlToLocation(
  rawUrl: string,
): Promise<ResolvedMapsLocation | null> {
  const url = rawUrl.trim();
  if (!url) return null;

  const cacheKey = url.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) {
    return { city: hit.city, state: hit.state };
  }

  // Resolve short → long se necessário
  let longUrl = url;
  if (isShortUrl(url)) {
    const followed = await followShortUrl(url);
    if (followed) longUrl = followed;
  }

  const extracted = extractFromLongUrl(longUrl);
  if (!extracted) return null;

  let result: ResolvedMapsLocation | null = null;
  if (extracted.type === "name") {
    result = await nominatimSearch(extracted.value);
  } else if (extracted.type === "coords") {
    result = await nominatimReverse(extracted.lat, extracted.lng);
  }

  if (result) {
    cache.set(cacheKey, { ...result, at: Date.now() });
  }
  return result;
}
