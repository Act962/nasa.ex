/**
 * composite-face-pipoya.ts
 *
 * Composta uma foto de rosto nas regiões de cabeça de cada frame
 * de um spritesheet Pipoya (96×128px, 3 colunas × 4 linhas, 32×32 por frame).
 *
 * Espelhado de composite-visor.ts, mas adaptado para o formato Pipoya.
 */

// Coordenadas locais dentro de cada frame 32×32 (cx,cy = centro; rx,ry = raios da elipse)
const FACE_REGIONS = {
  down:  { cx: 16, cy: 9, rx: 7, ry: 7 }, // row 0 — rosto virado para frente
  left:  { cx: 13, cy: 9, rx: 4, ry: 7 }, // row 1 — perfil esquerdo
  right: { cx: 19, cy: 9, rx: 4, ry: 7 }, // row 2 — perfil direito
  up:    null,                              // row 3 — costas, sem rosto
} as const;

const ROW_DIRS = [
  { row: 0, region: FACE_REGIONS.down  },
  { row: 1, region: FACE_REGIONS.left  },
  { row: 2, region: FACE_REGIONS.right },
  { row: 3, region: null               },
] as const;

const FRAME = 32;
const COLS  = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
    img.src = src;
  });
}

/**
 * Recebe a URL do spritesheet base (96×128) e a URL/objectURL da foto de rosto.
 * Retorna um objectURL com a foto baked em cada frame que tem rosto visível.
 */
export async function buildFaceOnPipoyaSprite(
  baseSrc: string,
  faceSrc: string,
): Promise<string> {
  const [baseImg, faceImg] = await Promise.all([
    loadImage(baseSrc),
    loadImage(faceSrc),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width  = baseImg.naturalWidth;  // 96
  canvas.height = baseImg.naturalHeight; // 128
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(baseImg, 0, 0);

  for (const { row, region } of ROW_DIRS) {
    if (!region) continue;

    for (let col = 0; col < COLS; col++) {
      ctx.save();
      ctx.translate(col * FRAME, row * FRAME);

      // Clip na elipse da região da cabeça
      ctx.beginPath();
      ctx.ellipse(region.cx, region.cy, region.rx, region.ry, 0, 0, Math.PI * 2);
      ctx.clip();

      // Composta a foto centralizada e cortada para preencher a elipse
      const dw = region.rx * 2;
      const dh = region.ry * 2;
      const dx = region.cx - region.rx;
      const dy = region.cy - region.ry;
      const scale = Math.max(dw / faceImg.width, dh / faceImg.height);
      const sw = dw / scale;
      const sh = dh / scale;
      const sx = (faceImg.width  - sw) / 2;
      const sy = (faceImg.height - sh) / 2;
      ctx.drawImage(faceImg, sx, sy, sw, sh, dx, dy, dw, dh);

      ctx.restore();
    }
  }

  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob!)), "image/png"),
  );
}
