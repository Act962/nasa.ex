/**
 * composite-visor.ts
 *
 * Recebe o spritesheet base do astronauta pixel-art (visor transparente)
 * e composta a foto de perfil circular em cada frame de visor.
 */

export const VISOR_REGIONS: Record<"S" | "W" | "E" | "N", { cx: number; cy: number; rx: number; ry: number } | null> = {
  S: { cx: 32, cy: 11, rx: 7,  ry: 6  },
  W: { cx: 27, cy: 11, rx: 4,  ry: 5  },
  E: { cx: 37, cy: 11, rx: 4,  ry: 5  },
  N: null,
};

const ROW_DIR: Record<number, "S" | "W" | "N" | "E"> = {
  8: "S", 9: "W", 10: "N", 11: "E",
};

const FRAME = 64;
const COLS  = 9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function buildVisorSpritesheet(
  baseSrc: string,
  profileSrc: string | null | undefined,
): Promise<string> {
  const baseImg = await loadImage(baseSrc);
  const canvas  = document.createElement("canvas");
  canvas.width  = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseImg, 0, 0);

  if (!profileSrc) {
    ctx.fillStyle = "#3278d7";
    for (const [rowStr, dir] of Object.entries(ROW_DIR)) {
      const region = VISOR_REGIONS[dir];
      if (!region) continue;
      const row = Number(rowStr);
      for (let fi = 0; fi < COLS; fi++) {
        ctx.save();
        ctx.translate(fi * FRAME, row * FRAME);
        ctx.beginPath();
        ctx.ellipse(region.cx, region.cy, region.rx, region.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  } else {
    const profileImg = await loadImage(profileSrc);
    for (const [rowStr, dir] of Object.entries(ROW_DIR)) {
      const region = VISOR_REGIONS[dir];
      if (!region) continue;
      const row = Number(rowStr);
      for (let fi = 0; fi < COLS; fi++) {
        ctx.save();
        ctx.translate(fi * FRAME, row * FRAME);
        ctx.beginPath();
        ctx.ellipse(region.cx, region.cy, region.rx, region.ry, 0, 0, Math.PI * 2);
        ctx.clip();

        const dw = region.rx * 2;
        const dh = region.ry * 2;
        const dx = region.cx - region.rx;
        const dy = region.cy - region.ry;
        const scale = Math.max(dw / profileImg.width, dh / profileImg.height);
        const sw = dw / scale;
        const sh = dh / scale;
        const sx = (profileImg.width  - sw) / 2;
        const sy = (profileImg.height - sh) / 2;
        ctx.drawImage(profileImg, sx, sy, sw, sh, dx, dy, dw, dh);

        // Reflexo/brilho no visor
        const grd = ctx.createRadialGradient(
          region.cx - region.rx * 0.4, region.cy - region.ry * 0.4, 0,
          region.cx, region.cy, Math.max(region.rx, region.ry),
        );
        grd.addColorStop(0, "rgba(255,255,255,0.18)");
        grd.addColorStop(1, "rgba(0,20,80,0.35)");
        ctx.fillStyle = grd;
        ctx.fillRect(dx, dy, dw, dh);

        ctx.restore();
      }
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), "image/png");
  });
}
