/**
 * tiled-loader.ts
 *
 * Fetch e parse de mapas Tiled JSON (.tmj).
 * Resolve caminhos relativos de tilesets para URLs absolutas e detecta
 * o ponto de spawn a partir de uma objectgroup chamada "areas".
 */

export interface TiledTilesetRef {
  /** Chave única usada no Phaser (ex: "tileset_0") */
  key:      string;
  /** URL absoluta da imagem do tileset */
  imageUrl: string;
  /** Nome original do tileset no JSON */
  name:     string;
}

export interface TiledMapMeta {
  /** Chave usada em load.tilemapTiledJSON */
  mapKey:   string;
  /** URL original do arquivo .tmj */
  mapUrl:   string;
  /** Tilesets externos com URLs resolvidas */
  tilesets: TiledTilesetRef[];
  /** Largura do mapa em pixels */
  widthPx:  number;
  /** Altura do mapa em pixels */
  heightPx: number;
  /** X do spawn detectado (ou 0 se não encontrado) */
  spawnX:   number;
  /** Y do spawn detectado (ou 0 se não encontrado) */
  spawnY:   number;
}

/* ─── Tipos internos do JSON Tiled ──────────────────────────────────────── */

interface TiledJSON {
  type:       "map";
  width:      number;
  height:     number;
  tilewidth:  number;
  tileheight: number;
  layers:     TiledLayer[];
  tilesets:   TiledTileset[];
}

interface TiledLayer {
  type:        "tilelayer" | "objectgroup" | "group" | "imagelayer";
  name:        string;
  objects?:    TiledObject[];
  data?:       number[];
  properties?: Array<{ name: string; type: string; value: unknown }>;
}

interface TiledObject {
  x:      number;
  y:      number;
  width:  number;
  height: number;
  type:   string;
  name:   string;
  class?: string; // Tiled 1.9+ usa "class" em vez de "type"
}

interface TiledTileset {
  name:       string;
  firstgid:   number;
  image?:     string;  // undefined = tileset embutido (embedded)
  imagewidth?: number;
  imageheight?: number;
  tilecount?: number;
  tiles?:     unknown[];
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith("http://") || relative.startsWith("https://") || relative.startsWith("/")) {
    return relative;
  }
  return base + relative;
}

function baseOf(url: string): string {
  const last = url.lastIndexOf("/");
  return last >= 0 ? url.substring(0, last + 1) : "";
}

function isTiledJSON(json: unknown): json is TiledJSON {
  return (
    typeof json === "object" &&
    json !== null &&
    (json as Record<string, unknown>).type === "map" &&
    Array.isArray((json as Record<string, unknown>).layers) &&
    Array.isArray((json as Record<string, unknown>).tilesets)
  );
}

/* ─── API pública ─────────────────────────────────────────────────────────── */

/**
 * Faz fetch do arquivo .tmj, valida o formato, resolve os tilesets externos
 * e detecta o ponto de spawn a partir de uma objectgroup chamada "areas".
 *
 * Retorna `null` se:
 * - A URL falhar (rede, CORS, 404)
 * - O JSON não for um mapa Tiled válido
 */
export async function fetchTiledMeta(
  mapUrl:   string,
  baseUrl?: string,
): Promise<TiledMapMeta | null> {
  let json: unknown;
  try {
    const res = await fetch(mapUrl);
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  if (!isTiledJSON(json)) return null;

  const base = baseUrl ?? baseOf(mapUrl);

  // Resolver tilesets externos (tilesets com image = arquivo separado)
  const tilesets: TiledTilesetRef[] = json.tilesets
    .filter((ts): ts is TiledTileset & { image: string } => typeof ts.image === "string")
    .map((ts, i) => ({
      key:      `wa_tileset_${i}`,
      imageUrl: resolveUrl(base, ts.image),
      name:     ts.name,
    }));

  // Detectar spawn: procura em qualquer objectgroup pela primeira área "entry"
  let spawnX = 0;
  let spawnY = 0;

  const objectLayers = json.layers.filter(l => l.type === "objectgroup");
  outer: for (const layer of objectLayers) {
    for (const obj of layer.objects ?? []) {
      const kind = obj.type || obj.class || obj.name;
      if (kind.toLowerCase().includes("entry") || kind.toLowerCase().includes("spawn")) {
        spawnX = obj.x + obj.width / 2;
        spawnY = obj.y + obj.height / 2;
        break outer;
      }
    }
  }

  return {
    mapKey:  "wa_tiled_map",
    mapUrl,
    tilesets,
    widthPx:  json.width  * json.tilewidth,
    heightPx: json.height * json.tileheight,
    spawnX,
    spawnY,
  };
}

/**
 * Valida um objeto JSON já carregado (sem rede).
 * Útil para validar o conteúdo de um arquivo local antes de fazer upload.
 */
export function validateTiledJSON(json: unknown): json is TiledJSON {
  return isTiledJSON(json);
}
