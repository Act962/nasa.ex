/**
 * tiled-canvas-renderer.ts
 *
 * Renderiza um mapa Tiled JSON (formato WorkAdventure) num <canvas> HTML.
 * Filtra automaticamente:
 *  - Layers funcionais da WA (zonas, colisões, triggers) — não são visuais
 *  - Tiles de tilesets de zonas (special_zones, collision) — transparentes na WA
 *  - Layers com visible=false
 *
 * Suporta group layers (recursivo), opacity por layer.
 */

/* ─── Tipos internos ─────────────────────────────────────────────────────── */

interface TiledJson {
  width:      number;
  height:     number;
  tilewidth:  number;
  tileheight: number;
  layers:     TiledLayer[];
  tilesets:   TiledTilesetDef[];
}

interface TiledLayer {
  type:     "tilelayer" | "objectgroup" | "group" | "imagelayer";
  name:     string;
  visible?: boolean;
  opacity?: number;
  data?:    number[];
  width?:   number;
  height?:  number;
  layers?:  TiledLayer[];
  properties?: Array<{ name: string; type: string; value: unknown }>;
}

interface TiledTilesetDef {
  firstgid:     number;
  name:         string;
  image?:       string;
  imagewidth?:  number;
  imageheight?: number;
  tilewidth?:   number;
  tileheight?:  number;
  tilecount?:   number;
  columns?:     number;
  spacing?:     number;
  margin?:      number;
}

interface LoadedTileset extends TiledTilesetDef {
  img:     HTMLImageElement;
  tw:      number;
  th:      number;
  cols:    number;
  spacing: number;
  margin:  number;
  /** Tileset contém apenas tiles de zona/trigger — não renderizar visualmente */
  isZone:  boolean;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function resolveUrl(base: string, path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;
  return base.endsWith("/") ? base + path : base + "/" + path;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("img load failed: " + src));
    img.src = src;
  });
}

/**
 * Tilesets que contêm tiles funcionais/de-zona da WorkAdventure.
 * Esses tiles são invisíveis no WA (usados apenas como triggers/colisões).
 */
const ZONE_TILESET_PATTERN = /special.?zone|^zone|collision|trigger|silent|jitsi|floorLayer/i;

/**
 * Layers cujo conteúdo é exclusivamente funcional (triggers, zonas, colisões).
 * Serão pulados na renderização visual.
 */
const FUNCTIONAL_LAYER_PATTERN =
  /^(start|silent|explore|cafeteria|from-|to-|seat|embed|zone|jitsi|collisions?|toRoom|needHelp|follow|halo|open|close|config|floorLayer|cta|doorTip|stepRestRoom|abovePlayer)/i;

function isZoneTileset(name: string): boolean {
  return ZONE_TILESET_PATTERN.test(name);
}

function isFunctionalLayer(layer: TiledLayer): boolean {
  // Layer explicitamente invisível
  if (layer.visible === false) return true;
  // Objectgroups são sempre funcionais (areas, zonas, spawn points)
  if (layer.type === "objectgroup") return true;
  // Nome indica layer funcional da WA
  if (FUNCTIONAL_LAYER_PATTERN.test(layer.name)) return true;
  return false;
}

function isFunctionalGroup(layer: TiledLayer): boolean {
  if (layer.visible === false) return true;
  if (FUNCTIONAL_LAYER_PATTERN.test(layer.name)) return true;
  const props = layer.properties ?? [];
  if (props.some(p => p.name === "customId" || p.name === "zone" || p.name === "jitsiRoom")) return true;
  return false;
}

function findTileset(gid: number, tilesets: LoadedTileset[]): LoadedTileset | null {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) return tilesets[i];
  }
  return null;
}

/** Achata grupos recursivamente preservando a ordem de renderização (bottom→top) */
function flattenLayers(layers: TiledLayer[]): TiledLayer[] {
  const out: TiledLayer[] = [];
  for (const l of layers) {
    if (l.type === "group" && l.layers) {
      // Grupos funcionais (zone, embed, seat, jitsi) são completamente pulados
      if (isFunctionalGroup(l)) continue;
      out.push(...flattenLayers(l.layers));
    } else {
      out.push(l);
    }
  }
  return out;
}

function drawTileLayer(
  ctx:      CanvasRenderingContext2D,
  layer:    TiledLayer,
  mapW:     number,
  tileW:    number,
  tileH:    number,
  tilesets: LoadedTileset[],
) {
  const data = layer.data;
  if (!data) return;
  const layerCols = layer.width ?? mapW;

  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;

  for (let i = 0; i < data.length; i++) {
    const gid = data[i];
    if (!gid) continue;

    const ts = findTileset(gid, tilesets);
    // Pular tiles de tilesets de zona (special_zones, etc.)
    if (!ts || ts.isZone) continue;

    const localId = gid - ts.firstgid;
    const srcX = ts.margin + (localId % ts.cols) * (ts.tw + ts.spacing);
    const srcY = ts.margin + Math.floor(localId / ts.cols) * (ts.th + ts.spacing);
    const dstX = (i % layerCols) * tileW;
    const dstY = Math.floor(i / layerCols) * tileH;

    try {
      ctx.drawImage(ts.img, srcX, srcY, ts.tw, ts.th, dstX, dstY, tileW, tileH);
    } catch { /* tile fora dos limites — silenciar */ }
  }

  ctx.restore();
}

/* ─── API pública ─────────────────────────────────────────────────────────── */

export interface TiledCanvasResult {
  canvas:   HTMLCanvasElement;
  widthPx:  number;
  heightPx: number;
  spawnX:   number;
  spawnY:   number;
}

/* ─── Cache (Cache API) ──────────────────────────────────────────────────── */

const CACHE_NAME = "tiled-rendered-v1";
const cacheKeyFor = (url: string) => `https://tiled-cache.local/${encodeURIComponent(url)}`;

async function tryLoadCached(mapUrl: string): Promise<TiledCanvasResult | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(CACHE_NAME);
    const res   = await cache.match(cacheKeyFor(mapUrl));
    if (!res) return null;
    const meta = JSON.parse(res.headers.get("x-tiled-meta") || "{}");
    if (!meta.widthPx) return null;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const img  = await loadImage(url);
    URL.revokeObjectURL(url);
    const canvas = document.createElement("canvas");
    canvas.width  = meta.widthPx;
    canvas.height = meta.heightPx;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return { canvas, widthPx: meta.widthPx, heightPx: meta.heightPx, spawnX: meta.spawnX ?? 0, spawnY: meta.spawnY ?? 0 };
  } catch {
    return null;
  }
}

async function saveCached(mapUrl: string, result: TiledCanvasResult): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const blob = await new Promise<Blob | null>(r => result.canvas.toBlob(r, "image/png"));
    if (!blob) return;
    const cache = await caches.open(CACHE_NAME);
    const headers = new Headers({
      "content-type":  "image/png",
      "x-tiled-meta":  JSON.stringify({
        widthPx:  result.widthPx,
        heightPx: result.heightPx,
        spawnX:   result.spawnX,
        spawnY:   result.spawnY,
      }),
    });
    await cache.put(cacheKeyFor(mapUrl), new Response(blob, { headers }));
  } catch { /* cache write failure is non-fatal */ }
}

export async function renderTiledMapToCanvas(
  mapUrl:  string,
  baseUrl: string,
): Promise<TiledCanvasResult> {
  // Cache hit: decodifica 1 PNG em vez de baixar 50 tilesets
  const cached = await tryLoadCached(mapUrl);
  if (cached) {
    console.log("[tiled] cache hit:", mapUrl);
    return cached;
  }

  const res = await fetch(mapUrl);
  if (!res.ok) throw new Error("Mapa não encontrado: HTTP " + res.status);
  const json: TiledJson = await res.json();
  if (!json || json.width === undefined) throw new Error("JSON inválido");

  const mapW  = json.width;
  const mapH  = json.height;
  const tileW = json.tilewidth;
  const tileH = json.tileheight;

  // Carregar tilesets em paralelo (silenciar falhas individuais)
  const loadedRaw = await Promise.all(
    json.tilesets
      .filter(ts => ts.image)
      .map(async ts => {
        try {
          const url  = resolveUrl(baseUrl, ts.image!);
          const img  = await loadImage(url);
          const tw   = ts.tilewidth  ?? tileW;
          const th   = ts.tileheight ?? tileH;
          const sp   = ts.spacing    ?? 0;
          const mg   = ts.margin     ?? 0;
          const cols = ts.columns    ?? Math.max(1, Math.floor(((ts.imagewidth ?? 0) - mg) / (tw + sp)));
          return {
            ...ts, img, tw, th, cols,
            spacing: sp,
            margin:  mg,
            isZone:  isZoneTileset(ts.name),
          } as LoadedTileset;
        } catch {
          return null;
        }
      })
  );
  const tilesets = loadedRaw.filter((ts): ts is LoadedTileset => ts !== null);

  // Canvas de saída
  const canvas = document.createElement("canvas");
  canvas.width  = mapW * tileW;
  canvas.height = mapH * tileH;
  const ctx = canvas.getContext("2d")!;

  // Aplanar e filtrar layers, renderizar em ordem (bottom → top)
  const allLayers = flattenLayers(json.layers);
  const drawn: string[] = [];
  const skipped: string[] = [];
  for (const layer of allLayers) {
    if (layer.type !== "tilelayer") { skipped.push(`${layer.name}(${layer.type})`); continue; }
    if (isFunctionalLayer(layer))   { skipped.push(`${layer.name}(func)`);          continue; }
    drawTileLayer(ctx, layer, mapW, tileW, tileH, tilesets);
    drawn.push(layer.name);
  }
  console.log("[tiled] drawn layers:", drawn);
  console.log("[tiled] skipped layers:", skipped);
  console.log("[tiled] tilesets:", tilesets.map(t => `${t.name}${t.isZone ? "(zone)" : ""}`));

  // Detectar spawn — WA usa tilelayers nomeadas "start" ou com property startLayer:true.
  // O primeiro tile não-zero dessa layer é a posição inicial.
  let spawnX = 0;
  let spawnY = 0;
  const allFlat = flattenAll(json.layers);

  // 1ª tentativa: tilelayer "start" ou com startLayer=true
  const startCandidates = allFlat.filter(l => {
    if (l.type !== "tilelayer") return false;
    if (l.name === "start") return true;
    return (l.properties ?? []).some(p => p.name === "startLayer" && p.value === true);
  });
  for (const sl of startCandidates) {
    if (!sl.data) continue;
    const cols = sl.width ?? mapW;
    const idx  = sl.data.findIndex(g => g);
    if (idx >= 0) {
      spawnX = (idx % cols) * tileW + tileW / 2;
      spawnY = Math.floor(idx / cols) * tileH + tileH / 2;
      break;
    }
  }

  // 2ª tentativa: object com type/name/class "entry"|"spawn"
  if (!spawnX && !spawnY) {
    outer: for (const ol of allFlat.filter(l => l.type === "objectgroup")) {
      const objects = (ol as unknown as { objects?: Array<{ x: number; y: number; width?: number; height?: number; type?: string; name?: string; class?: string }> }).objects ?? [];
      for (const obj of objects) {
        const kind = obj.type ?? obj.class ?? obj.name ?? "";
        if (/entry|spawn/i.test(kind)) {
          spawnX = obj.x + (obj.width ?? 0) / 2;
          spawnY = obj.y + (obj.height ?? 0) / 2;
          break outer;
        }
      }
    }
  }

  // Fallback: centro do mapa (evita spawn em (0,0) — área de céu)
  if (!spawnX && !spawnY) {
    spawnX = (mapW * tileW) / 2;
    spawnY = (mapH * tileH) / 2;
  }

  console.log("[tiled] spawn:", { spawnX, spawnY });
  const result: TiledCanvasResult = { canvas, widthPx: canvas.width, heightPx: canvas.height, spawnX, spawnY };
  // Salva no cache em background — não bloqueia o retorno
  void saveCached(mapUrl, result);
  return result;
}

/** Aplana TODAS as layers (incluindo grupos funcionais) para busca de spawns */
function flattenAll(layers: TiledLayer[]): TiledLayer[] {
  const out: TiledLayer[] = [];
  for (const l of layers) {
    if (l.type === "group" && l.layers) out.push(...flattenAll(l.layers));
    else out.push(l);
  }
  return out;
}
