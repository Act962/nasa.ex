/**
 * Geocoding via Nominatim (OpenStreetMap).
 * Gratuito, sem chave de API. Limites: ≤1 req/s e User-Agent obrigatório.
 * Usado server-side ao salvar endereço da Organization.
 */

interface CacheEntry { lat: number; lng: number; at: number }

const cache = new Map<string, CacheEntry>();
const TTL = 1000 * 60 * 60 * 24 * 30; // 30 dias

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? "NASA-SpaceStation/1.0 (contato@nasaagents.com)";

export interface GeocodeResult { lat: number; lng: number }

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { lat: hit.lat, lng: hit.lng };

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    if (!json[0]) return null;
    const out = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    cache.set(key, { ...out, at: Date.now() });
    return out;
  } catch {
    return null;
  }
}
