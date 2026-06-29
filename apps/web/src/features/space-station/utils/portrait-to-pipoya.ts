/**
 * portraitToPipoya
 * Converts any portrait image (JPEG, PNG, WEBP…) into a Pipoya-compatible
 * 96×128 spritesheet (3 cols × 4 rows, 32×32 frames, RGBA PNG).
 *
 * Pipeline:
 *   1. Draw original onto a full-size temp canvas
 *   2. Remove background via BFS flood-fill from all edges (handles solid &
 *      gradient backgrounds without any external API)
 *   3. Centre-crop + scale result to 32×32 — preserving alpha
 *   4. Tile across 4-direction × 3-frame grid with subtle walk bob
 *
 * Row layout (standard Pipoya):
 *   0 = walk-down  (face camera)
 *   1 = walk-left  (face camera, h-flipped)
 *   2 = walk-right (face camera, not flipped)
 *   3 = walk-up    (facing away — darkened)
 *
 * Column layout:
 *   0 = left-stride  (bob up 1 px)
 *   1 = neutral/idle (no bob)
 *   2 = right-stride (bob up 1 px)
 */

import { removeBackground } from "./remove-background";

const FRAME = 32;
const COLS  = 3;
const ROWS  = 4;
const W     = FRAME * COLS; // 96
const H     = FRAME * ROWS; // 128
const BOB   = [-1, 0, -1];  // per-column vertical offset (px)

/* ─── Main converter ─────────────────────────────────────────────────────── */

export async function portraitToPipoya(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  // Draw original onto a temp canvas for background removal
  const tmp = document.createElement("canvas");
  tmp.width  = bitmap.width;
  tmp.height = bitmap.height;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(bitmap, 0, 0);
  removeBackground(tmp);

  // Centre-crop to square then scale to 32×32 (preserving alpha)
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width  = FRAME;
  baseCanvas.height = FRAME;
  const bctx = baseCanvas.getContext("2d")!;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  const srcSize = Math.min(tmp.width, tmp.height);
  const srcX    = (tmp.width  - srcSize) / 2;
  const srcY    = (tmp.height - srcSize) / 2;
  bctx.drawImage(tmp, srcX, srcY, srcSize, srcSize, 0, 0, FRAME, FRAME);

  // Build the 96×128 spritesheet
  const out = document.createElement("canvas");
  out.width  = W;
  out.height = H;
  const ctx  = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  function placeFrame(col: number, row: number, bobY: number, flipH: boolean) {
    ctx.save();
    ctx.translate(col * FRAME + (flipH ? FRAME : 0), row * FRAME + bobY);
    if (flipH) ctx.scale(-1, 1);
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.restore();
  }

  // Row 0: walk-down  (face-on)
  for (let c = 0; c < COLS; c++) placeFrame(c, 0, BOB[c], false);

  // Row 1: walk-left  (h-flipped)
  for (let c = 0; c < COLS; c++) placeFrame(c, 1, BOB[c], true);

  // Row 2: walk-right
  for (let c = 0; c < COLS; c++) placeFrame(c, 2, BOB[c], false);

  // Row 3: walk-up (facing away — darken with multiply blend)
  for (let c = 0; c < COLS; c++) placeFrame(c, 3, BOB[c], false);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(80, 80, 120, 0.55)";
  ctx.fillRect(0, 3 * FRAME, W, FRAME);
  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("Canvas toBlob falhou"))),
      "image/png",
    );
  });
}

/** Returns a local blob: URL for preview; caller must revoke it when done. */
export async function portraitToPipoyaUrl(file: File): Promise<string> {
  const blob = await portraitToPipoya(file);
  return URL.createObjectURL(blob);
}
