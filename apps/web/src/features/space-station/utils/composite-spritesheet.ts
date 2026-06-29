/**
 * composite-spritesheet.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Builds a single spritesheet canvas by layering multiple PNGs on top of a
 * base spritesheet. Handles format mismatches (Pipoya 32×32 vs LPC 64×64) by
 * scaling each overlay to match the base frame size.
 *
 * The returned canvas has the same dimensions and frame layout as the base,
 * so downstream code (Phaser addSpriteSheet, idle-frame extraction) works
 * unchanged regardless of how many overlays are composited.
 */

export interface CompositeLayers {
  base:       string;                    // required — the body spritesheet
  eyes?:      string | null;
  hair?:      string | null;
  clothes?:   string | null;
  hat?:       string | null;
  accessory?: string | null;
}

/**
 * Load an HTMLImageElement from a URL with CORS enabled.
 * Resolves to `null` on error so missing/broken overlays don't abort the chain.
 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Compose `layers` into a single canvas matching the base spritesheet's size.
 * Overlays that fail to load are simply skipped. Order of composition
 * (bottom → top): base → clothes → hair → eyes → hat → accessory — this
 * mirrors the LPC layering convention used by WorkAdventure/LPC-ProjectGen.
 *
 * Returns `null` if the base itself fails to load.
 */
export async function buildCompositeSpritesheet(
  layers: CompositeLayers,
): Promise<HTMLCanvasElement | null> {
  const base = await loadImage(layers.base);
  if (!base) return null;

  const canvas = document.createElement("canvas");
  canvas.width  = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);

  // Draw overlays in proper LPC z-order (bottom-first so later layers cover)
  const overlayOrder: Array<keyof CompositeLayers> = [
    "clothes", "hair", "eyes", "hat", "accessory",
  ];

  for (const key of overlayOrder) {
    const url = layers[key];
    if (!url) continue;
    const img = await loadImage(url);
    if (!img) continue;

    // If the overlay already matches the base dimensions, draw 1:1.
    // Otherwise scale the overlay canvas to fit the base. This handles both
    // Pipoya base (smaller) + LPC overlays (larger) and vice-versa.
    if (img.naturalWidth === base.naturalWidth &&
        img.naturalHeight === base.naturalHeight) {
      ctx.drawImage(img, 0, 0);
    } else {
      ctx.drawImage(
        img,
        0, 0, img.naturalWidth, img.naturalHeight,
        0, 0, base.naturalWidth, base.naturalHeight,
      );
    }
  }

  return canvas;
}

/**
 * Stable hash of the selected layers — used as a cache key / texture key so
 * identical composites are reused instead of rebuilt.
 */
export function hashLayers(layers: CompositeLayers): string {
  const parts = [
    layers.base,
    layers.clothes   ?? "",
    layers.hair      ?? "",
    layers.eyes      ?? "",
    layers.hat       ?? "",
    layers.accessory ?? "",
  ];
  let h = 5381;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
