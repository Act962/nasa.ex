import type { TileTextureKey, TileLayerName } from "../../../types";

export interface TilePreset {
  key:     TileTextureKey;
  label:   string;
  layer:   TileLayerName;
  color:   string;
  emoji:   string;
}

export const TILE_PRESETS: TilePreset[] = [
  // ─── Pisos ─────────────────────────────────────────────
  { key: "floor_wood",       label: "Madeira",     layer: "floor",      color: "#a0783c", emoji: "🪵" },
  { key: "floor_plank",      label: "Tábuas",      layer: "floor",      color: "#b08050", emoji: "🪵" },
  { key: "floor_parquet",    label: "Parquet",     layer: "floor",      color: "#b48a5a", emoji: "🏛️" },
  { key: "floor_stone",      label: "Pedra",       layer: "floor",      color: "#8a8a8a", emoji: "🪨" },
  { key: "floor_cobble",     label: "Paralelepípedo", layer: "floor",   color: "#6e6e6e", emoji: "🪨" },
  { key: "floor_marble",     label: "Mármore",     layer: "floor",      color: "#e8e4dd", emoji: "🤍" },
  { key: "floor_carpet",     label: "Tapete",      layer: "floor",      color: "#7b4f9c", emoji: "🟪" },
  { key: "floor_concrete",   label: "Concreto",    layer: "floor",      color: "#b0b0b0", emoji: "⬜" },
  { key: "floor_metal",      label: "Metal",       layer: "floor",      color: "#7090a0", emoji: "⚙️" },
  { key: "floor_tech",       label: "Tech",        layer: "floor",      color: "#1d3b66", emoji: "💾" },
  { key: "floor_glass",      label: "Vidro",       layer: "floor",      color: "#a0d8ef", emoji: "🪟" },
  { key: "floor_tile_white", label: "Azulejo",     layer: "floor",      color: "#eeeeee", emoji: "⬜" },
  { key: "floor_tile_dark",  label: "Ladrilho",    layer: "floor",      color: "#2e2e3a", emoji: "🔲" },
  { key: "floor_checker",    label: "Xadrez",      layer: "floor",      color: "#ffffff", emoji: "♟️" },
  { key: "floor_brick",      label: "Tijolo piso", layer: "floor",      color: "#c06c40", emoji: "🟧" },
  { key: "floor_hex",        label: "Hexagonal",   layer: "floor",      color: "#8c8ca0", emoji: "⬢" },
  { key: "floor_sand",       label: "Areia",       layer: "floor",      color: "#e3cf92", emoji: "🏖️" },
  { key: "floor_dirt",       label: "Terra",       layer: "floor",      color: "#6b4326", emoji: "🟫" },
  { key: "floor_grass",      label: "Grama",       layer: "floor",      color: "#4a9f3c", emoji: "🌱" },
  { key: "floor_snow",       label: "Neve",        layer: "floor",      color: "#f2f5fb", emoji: "⛄" },
  { key: "floor_ice",        label: "Gelo",        layer: "floor",      color: "#b3ecff", emoji: "❄️" },
  { key: "floor_lava",       label: "Lava",        layer: "floor",      color: "#d94b1a", emoji: "🌋" },

  // ─── Paredes ───────────────────────────────────────────
  { key: "wall_brick",       label: "Tijolo",      layer: "wall",       color: "#c05030", emoji: "🧱" },
  { key: "wall_stone",       label: "Pedra",       layer: "wall",       color: "#7a7a7a", emoji: "🗿" },
  { key: "wall_concrete",    label: "Concreto",    layer: "wall",       color: "#909090", emoji: "🏗️" },
  { key: "wall_wood",        label: "Madeira",     layer: "wall",       color: "#8b6040", emoji: "🪵" },
  { key: "wall_metal",       label: "Metal",       layer: "wall",       color: "#6c7a90", emoji: "🔩" },
  { key: "wall_glass",       label: "Vidro",       layer: "wall",       color: "#7bc6e8", emoji: "🪟" },
  { key: "wall_tech",        label: "Tech",        layer: "wall",       color: "#0f2a4a", emoji: "🖥️" },
  { key: "wall_sandstone",   label: "Arenito",     layer: "wall",       color: "#c9a56e", emoji: "🏜️" },
  { key: "wall_hedge",       label: "Sebe",        layer: "wall",       color: "#2f6d2c", emoji: "🌳" },
  { key: "wall_ice",         label: "Gelo",        layer: "wall",       color: "#9fe0f0", emoji: "🧊" },
  { key: "wall_cave",        label: "Caverna",     layer: "wall",       color: "#3d2b24", emoji: "🕳️" },

  // ─── Decoração ─────────────────────────────────────────
  { key: "deco_water",       label: "Água",        layer: "decoration", color: "#3a8fd4", emoji: "💧" },
  { key: "deco_puddle",      label: "Poça",        layer: "decoration", color: "#5ba7d9", emoji: "💦" },
  { key: "deco_grass",       label: "Grama",       layer: "decoration", color: "#5fa83c", emoji: "🌿" },
  { key: "deco_bushes",      label: "Arbusto",     layer: "decoration", color: "#2d7328", emoji: "🌳" },
  { key: "deco_flowers",     label: "Flores",      layer: "decoration", color: "#e85d94", emoji: "🌸" },
  { key: "deco_leaves",      label: "Folhas",      layer: "decoration", color: "#c76a1f", emoji: "🍂" },
  { key: "deco_sand",        label: "Areia",       layer: "decoration", color: "#ddc68a", emoji: "🏜️" },
  { key: "deco_gravel",      label: "Cascalho",    layer: "decoration", color: "#8a8377", emoji: "🪨" },
  { key: "deco_rocks",       label: "Pedras",      layer: "decoration", color: "#676767", emoji: "🪨" },
  { key: "deco_snow",        label: "Neve",        layer: "decoration", color: "#ffffff", emoji: "❄️" },
  { key: "deco_lava",        label: "Lava",        layer: "decoration", color: "#ff6b1a", emoji: "🌋" },
  { key: "deco_fire",        label: "Fogo",        layer: "decoration", color: "#ff7824", emoji: "🔥" },
  { key: "deco_stars",       label: "Estrelas",    layer: "decoration", color: "#0b0b2a", emoji: "⭐" },
  { key: "deco_cloud",       label: "Nuvem",       layer: "decoration", color: "#eef3fb", emoji: "☁️" },
];

/* ─── helpers de cor ─────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const c = parseInt(hex.slice(1), 16);
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}
function rgbStr([r, g, b]: [number, number, number], a = 1) {
  return a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
function darken(hex: string, f: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [Math.floor(r * f), Math.floor(g * f), Math.floor(b * f)];
}
function lighten(hex: string, f: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [Math.min(255, Math.floor(r * f)), Math.min(255, Math.floor(g * f)), Math.min(255, Math.floor(b * f))];
}

/** Desenha uma prévia 32×32 de um tile em um canvas 2D — espelho do drawTilePattern do WorldScene */
export function drawTilePreviewCanvas(
  ctx: CanvasRenderingContext2D,
  key: TileTextureKey,
  color: string,
  x = 0,
  y = 0,
  size = 32,
) {
  const T = size;

  // Base fill
  ctx.fillStyle = color;
  ctx.fillRect(x, y, T, T);

  switch (key) {
    /* ─── PISOS ─────────────────────────────────────── */
    case "floor_wood": {
      ctx.fillStyle = rgbStr(darken(color, 0.82));
      for (let i = 1; i <= 3; i++) ctx.fillRect(x, y + i * 8, T, 1);
      ctx.fillStyle = rgbStr(darken(color, 0.9));
      for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 8 + 4, y + 2, 1, 4);
      break;
    }
    case "floor_plank": {
      ctx.fillStyle = rgbStr(darken(color, 0.75));
      ctx.fillRect(x, y + 10, T, 1);
      ctx.fillRect(x, y + 21, T, 1);
      ctx.fillStyle = rgbStr(darken(color, 0.88));
      ctx.fillRect(x + 15, y, 1, 10);
      ctx.fillRect(x + 8,  y + 11, 1, 10);
      ctx.fillRect(x + 23, y + 11, 1, 10);
      ctx.fillRect(x + 16, y + 22, 1, 10);
      break;
    }
    case "floor_parquet": {
      ctx.fillStyle = rgbStr(darken(color, 0.75));
      // Herringbone: retângulos 8×4 alternados
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillRect(x + c * 8, y + r * 8 + 7, 8, 1);
          } else {
            ctx.fillRect(x + c * 8 + 7, y + r * 8, 1, 8);
          }
        }
      }
      break;
    }
    case "floor_stone": {
      ctx.fillStyle = rgbStr(darken(color, 0.72));
      const seed = ((x * 31 + y * 17) % 255 + 255) % 255;
      for (const [dx, dy] of [
        [seed % T, (seed * 3) % T], [(seed * 7) % T, (seed * 11) % T],
        [(seed * 13) % T, (seed * 5) % T], [(seed * 19) % T, (seed * 23) % T],
      ] as [number, number][]) {
        ctx.fillRect(x + (dx % (T - 2)), y + (dy % (T - 2)), 2, 2);
      }
      break;
    }
    case "floor_cobble": {
      ctx.fillStyle = rgbStr(darken(color, 0.6));
      // Grid irregular de pedras
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.strokeStyle = rgbStr(darken(color, 0.4));
          ctx.lineWidth = 1;
          ctx.strokeRect(x + c * 8 + 0.5, y + r * 8 + 0.5, 7, 7);
        }
      }
      ctx.fillStyle = rgbStr(lighten(color, 1.15));
      ctx.fillRect(x + 2, y + 2, 1, 1);
      ctx.fillRect(x + 18, y + 10, 1, 1);
      ctx.fillRect(x + 26, y + 26, 1, 1);
      break;
    }
    case "floor_marble": {
      // Veias curvas
      ctx.strokeStyle = rgbStr(darken(color, 0.65));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 6);
      ctx.bezierCurveTo(x + 8, y + 3, x + 22, y + 14, x + 30, y + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 22);
      ctx.bezierCurveTo(x + 14, y + 28, x + 18, y + 18, x + 30, y + 26);
      ctx.stroke();
      break;
    }
    case "floor_carpet": {
      ctx.fillStyle = rgbStr(darken(color, 0.78));
      for (let r = 0; r < 8; r++)
        for (let col = 0; col < 8; col++)
          if ((r + col) % 2 === 0) ctx.fillRect(x + col * 4, y + r * 4, 2, 2);
      break;
    }
    case "floor_concrete": {
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      for (let i = 0; i < 8; i++) ctx.fillRect(x + 6 + i, y + 4 + i, 1, 1);
      ctx.fillStyle = rgbStr(darken(color, 0.85));
      ctx.fillRect(x, y + 16, T, 1);
      break;
    }
    case "floor_metal": {
      ctx.fillStyle = rgbStr(lighten(color, 1.15));
      for (let i = 1; i < 4; i++) {
        ctx.fillRect(x, y + i * 8, T, 1);
        ctx.fillRect(x + i * 8, y, 1, T);
      }
      ctx.fillStyle = rgbStr(darken(color, 0.75));
      for (const [dx, dy] of [[2,2],[T-4,2],[2,T-4],[T-4,T-4]] as [number,number][]) {
        ctx.fillRect(x + dx, y + dy, 2, 2);
      }
      break;
    }
    case "floor_tech": {
      ctx.strokeStyle = rgbStr(lighten(color, 2.5));
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4 + 0.5, y + 4 + 0.5, 23, 23);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 16); ctx.lineTo(x + 12, y + 16);
      ctx.moveTo(x + 20, y + 16); ctx.lineTo(x + 28, y + 16);
      ctx.moveTo(x + 16, y + 4); ctx.lineTo(x + 16, y + 12);
      ctx.moveTo(x + 16, y + 20); ctx.lineTo(x + 16, y + 28);
      ctx.stroke();
      ctx.fillStyle = "#00ffd0";
      ctx.fillRect(x + 15, y + 15, 3, 3);
      break;
    }
    case "floor_glass": {
      ctx.fillStyle = rgbStr(lighten(color, 1.2), 0.4);
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + 2, y + 2, 6, 3);
      ctx.fillRect(x + 22, y + 20, 4, 2);
      break;
    }
    case "floor_tile_white":
    case "floor_tile_dark": {
      // Ladrilho 16×16 com grout
      ctx.fillStyle = rgbStr(darken(color, 0.55));
      ctx.fillRect(x, y + 15, T, 2);
      ctx.fillRect(x + 15, y, 2, T);
      break;
    }
    case "floor_checker": {
      // Xadrez 16×16 preto/branco (color = branco)
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x, y, 16, 16);
      ctx.fillRect(x + 16, y + 16, 16, 16);
      break;
    }
    case "floor_brick": {
      ctx.fillStyle = rgbStr(darken(color, 0.55));
      for (let row = 0; row < 4; row++) ctx.fillRect(x, y + row * 8 + 7, T, 1);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 === 0 ? 0 : 16;
        for (let c2 = 0; c2 <= 32; c2 += 16) ctx.fillRect(x + c2 + off, y + row * 8, 1, 7);
      }
      break;
    }
    case "floor_hex": {
      ctx.strokeStyle = rgbStr(darken(color, 0.55));
      ctx.lineWidth = 1;
      const hexH = 10;
      const hexW = 8;
      for (let row = -1; row < 4; row++) {
        for (let col = -1; col < 5; col++) {
          const cx = col * hexW + (row % 2 ? hexW / 2 : 0);
          const cy = row * (hexH - 2);
          ctx.beginPath();
          ctx.moveTo(x + cx,         y + cy + hexH / 2);
          ctx.lineTo(x + cx + hexW/2, y + cy);
          ctx.lineTo(x + cx + hexW,   y + cy + hexH / 2);
          ctx.lineTo(x + cx + hexW,   y + cy + hexH);
          ctx.lineTo(x + cx + hexW/2, y + cy + hexH + hexH / 2);
          ctx.lineTo(x + cx,         y + cy + hexH);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
    case "floor_sand": {
      ctx.fillStyle = rgbStr(darken(color, 0.85));
      for (let i = 0; i < 20; i++) {
        const sx = ((x * 37 + y * 13 + i * 7) % T);
        const sy = ((x * 19 + y * 23 + i * 11) % T);
        ctx.fillRect(x + sx, y + sy, 1, 1);
      }
      ctx.strokeStyle = rgbStr(darken(color, 0.78));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 10); ctx.bezierCurveTo(x + 10, y + 7, x + 20, y + 13, x + T, y + 10);
      ctx.stroke();
      break;
    }
    case "floor_dirt": {
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      const seed = ((x * 23 + y * 29) % 255 + 255) % 255;
      for (let i = 0; i < 18; i++) {
        const dx = (seed * (i + 3) * 7) % T;
        const dy = (seed * (i + 5) * 11) % T;
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
      ctx.fillStyle = rgbStr(lighten(color, 1.2));
      ctx.fillRect(x + 8, y + 20, 2, 1);
      ctx.fillRect(x + 22, y + 6, 2, 1);
      break;
    }
    case "floor_grass": {
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      const seed = ((x * 13 + y * 7) % 16 + 16) % 16;
      for (let i = 0; i < 14; i++) {
        const bx = (seed * (i + 3) * 7) % (T - 2);
        const by = (seed * (i + 5) * 11) % (T - 3);
        ctx.fillRect(x + bx, y + by, 1, 3);
      }
      ctx.fillStyle = rgbStr(lighten(color, 1.3));
      for (let i = 0; i < 6; i++) {
        const bx = (seed * (i + 7) * 13) % (T - 1);
        const by = (seed * (i + 9) * 17) % (T - 2);
        ctx.fillRect(x + bx, y + by, 1, 2);
      }
      break;
    }
    case "floor_snow": {
      ctx.fillStyle = "rgba(180,200,230,0.45)";
      for (const [dx, dy] of [[4,4],[20,10],[12,22],[28,18],[6,26]] as [number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "floor_ice": {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 14, y + 14);
      ctx.moveTo(x + 20, y + 6); ctx.lineTo(x + 28, y + 18);
      ctx.moveTo(x + 8, y + 22); ctx.lineTo(x + 22, y + 28);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(x + 3, y + 3, 2, 2);
      ctx.fillRect(x + 26, y + 24, 2, 2);
      break;
    }
    case "floor_lava": {
      ctx.fillStyle = "#ffb347";
      for (let wx = 0; wx < T; wx++) {
        const wy = Math.round(Math.sin((wx / T) * Math.PI * 3) * 3 + 16);
        ctx.fillRect(x + wx, y + wy, 1, 1);
      }
      ctx.fillStyle = "rgba(255,230,100,0.5)";
      for (const [dx, dy, r] of [[6,8,2],[22,20,3],[14,26,2]] as [number,number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    /* ─── PAREDES ───────────────────────────────────── */
    case "wall_brick": {
      ctx.fillStyle = rgbStr(darken(color, 0.6));
      for (let row = 0; row < 4; row++) ctx.fillRect(x, y + row * 8 + 7, T, 1);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 === 0 ? 0 : 14;
        ctx.fillRect(x + off, y + row * 8, 1, 7);
        ctx.fillRect(x + off + 14, y + row * 8, 1, 7);
        ctx.fillRect(x + off + 28, y + row * 8, 1, 7);
      }
      break;
    }
    case "wall_stone": {
      ctx.strokeStyle = rgbStr(darken(color, 0.5));
      ctx.lineWidth = 1;
      // Blocos de pedra irregulares
      ctx.strokeRect(x + 0.5, y + 0.5, 14, 11);
      ctx.strokeRect(x + 15.5, y + 0.5, 16, 8);
      ctx.strokeRect(x + 15.5, y + 9.5, 10, 12);
      ctx.strokeRect(x + 26.5, y + 9.5, 5, 15);
      ctx.strokeRect(x + 0.5, y + 12.5, 10, 11);
      ctx.strokeRect(x + 11.5, y + 12.5, 14, 11);
      ctx.strokeRect(x + 0.5, y + 24.5, 15, 7);
      ctx.strokeRect(x + 16.5, y + 24.5, 15, 7);
      ctx.fillStyle = rgbStr(lighten(color, 1.15));
      ctx.fillRect(x + 3, y + 3, 1, 1);
      ctx.fillRect(x + 20, y + 4, 1, 1);
      ctx.fillRect(x + 25, y + 28, 1, 1);
      break;
    }
    case "wall_concrete": {
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      for (let i = 0; i < 8; i++) ctx.fillRect(x + 6 + i, y + 4 + i, 1, 1);
      ctx.fillStyle = rgbStr(darken(color, 0.85));
      ctx.fillRect(x, y + 16, T, 1);
      break;
    }
    case "wall_wood": {
      ctx.fillStyle = rgbStr(darken(color, 0.8));
      ctx.fillRect(x, y + 10, T, 2);
      ctx.fillRect(x, y + 22, T, 2);
      ctx.fillStyle = rgbStr(darken(color, 0.9));
      ctx.fillRect(x + 16, y, 1, 10);
      ctx.fillRect(x + 16, y + 12, 1, 10);
      ctx.fillRect(x + 16, y + 24, 1, 8);
      break;
    }
    case "wall_metal": {
      ctx.fillStyle = rgbStr(lighten(color, 1.25));
      ctx.fillRect(x, y + 15, T, 2);
      ctx.fillStyle = rgbStr(darken(color, 0.65));
      ctx.fillRect(x, y + 14, T, 1);
      ctx.fillRect(x, y + 17, T, 1);
      // parafusos nas pontas
      ctx.fillStyle = rgbStr(darken(color, 0.5));
      for (const [dx, dy] of [[3,3],[T-5,3],[3,T-5],[T-5,T-5],[3,14],[T-5,14]] as [number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "wall_glass": {
      ctx.fillStyle = rgbStr(lighten(color, 1.25), 0.6);
      ctx.fillRect(x, y, T, T);
      // frame
      ctx.fillStyle = rgbStr(darken(color, 0.55));
      ctx.fillRect(x, y, T, 2);
      ctx.fillRect(x, y + T - 2, T, 2);
      ctx.fillRect(x, y, 2, T);
      ctx.fillRect(x + T - 2, y, 2, T);
      ctx.fillRect(x, y + 15, T, 1);
      ctx.fillRect(x + 15, y, 1, T);
      // reflexo
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(x + 4, y + 4, 3, 8);
      ctx.fillRect(x + 20, y + 20, 3, 6);
      break;
    }
    case "wall_tech": {
      ctx.fillStyle = rgbStr(lighten(color, 2.8));
      // trilhas de circuito
      ctx.fillRect(x + 3, y + 6, 10, 1);
      ctx.fillRect(x + 12, y + 6, 1, 10);
      ctx.fillRect(x + 12, y + 16, 8, 1);
      ctx.fillRect(x + 20, y + 10, 1, 10);
      ctx.fillRect(x + 20, y + 20, 9, 1);
      ctx.fillStyle = "#00ffe0";
      ctx.fillRect(x + 12, y + 5, 2, 2);
      ctx.fillRect(x + 19, y + 15, 2, 2);
      ctx.fillRect(x + 28, y + 19, 2, 2);
      break;
    }
    case "wall_sandstone": {
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      // Blocos grandes
      ctx.fillRect(x, y + 10, T, 1);
      ctx.fillRect(x, y + 21, T, 1);
      ctx.fillRect(x + 10, y, 1, 10);
      ctx.fillRect(x + 22, y + 11, 1, 10);
      ctx.fillRect(x + 10, y + 22, 1, 10);
      // Granulado
      ctx.fillStyle = rgbStr(darken(color, 0.85));
      for (let i = 0; i < 12; i++) {
        const sx = (x * 37 + i * 13) % T;
        const sy = (y * 19 + i * 7) % T;
        ctx.fillRect(x + sx, y + sy, 1, 1);
      }
      break;
    }
    case "wall_hedge": {
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      for (let i = 0; i < 20; i++) {
        const dx = (x * 23 + i * 7) % T;
        const dy = (y * 11 + i * 13) % T;
        ctx.fillRect(x + dx, y + dy, 2, 2);
      }
      ctx.fillStyle = rgbStr(lighten(color, 1.35));
      for (let i = 0; i < 10; i++) {
        const dx = (x * 29 + i * 11) % T;
        const dy = (y * 17 + i * 19) % T;
        ctx.fillRect(x + dx, y + dy, 1, 2);
      }
      break;
    }
    case "wall_ice": {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(x, y);       ctx.lineTo(x + 12, y);  ctx.lineTo(x + 6, y + 10);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + T, y);   ctx.lineTo(x + T - 10, y); ctx.lineTo(x + T - 4, y + 8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 15); ctx.lineTo(x + 15, y + 22);
      ctx.moveTo(x + 20, y + 18); ctx.lineTo(x + 28, y + 28);
      ctx.stroke();
      break;
    }
    case "wall_cave": {
      ctx.fillStyle = rgbStr(lighten(color, 1.6));
      const seed = ((x * 31 + y * 19) % 255 + 255) % 255;
      for (let i = 0; i < 12; i++) {
        const dx = (seed * (i + 3) * 7) % T;
        const dy = (seed * (i + 5) * 11) % T;
        ctx.fillRect(x + dx, y + dy, 2, 2);
      }
      ctx.fillStyle = rgbStr(darken(color, 0.5));
      for (let i = 0; i < 6; i++) {
        const dx = (seed * (i + 13) * 17) % (T - 3);
        const dy = (seed * (i + 7) * 23) % (T - 3);
        ctx.fillRect(x + dx, y + dy, 3, 3);
      }
      break;
    }

    /* ─── DECORAÇÃO ─────────────────────────────────── */
    case "deco_water": {
      ctx.fillStyle = rgbStr(lighten(color, 1.18));
      for (let wx = 0; wx < T; wx++) {
        const wy1 = Math.round(Math.sin((wx / T) * Math.PI * 2) * 2 + 10);
        const wy2 = Math.round(Math.sin((wx / T) * Math.PI * 2 + Math.PI) * 2 + 22);
        ctx.fillRect(x + wx, y + wy1, 1, 2);
        ctx.fillRect(x + wx, y + wy2, 1, 2);
      }
      break;
    }
    case "deco_puddle": {
      ctx.fillStyle = rgbStr(lighten(color, 1.15), 0.9);
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 18, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(x + 8, y + 14, 5, 1);
      ctx.fillRect(x + 20, y + 22, 3, 1);
      break;
    }
    case "deco_grass": {
      ctx.fillStyle = rgbStr(darken(color, 0.75));
      const seed2 = ((x * 13 + y * 7) % 16 + 16) % 16;
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(x + ((seed2 * (i + 3) * 7) % (T - 2)), y + ((seed2 * (i + 5) * 11) % (T - 4)), 2, 4);
      }
      break;
    }
    case "deco_bushes": {
      ctx.fillStyle = rgbStr(lighten(color, 1.3));
      for (const [dx, dy, r] of [[10,14,6],[22,10,5],[18,24,6]] as [number,number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgbStr(darken(color, 0.7));
      for (const [dx, dy] of [[8,16],[14,8],[24,14],[16,28]] as [number,number][]) {
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
      break;
    }
    case "deco_flowers": {
      const petals: [number, number, string][] = [
        [8, 10, "#ffc2d9"], [22, 16, "#ffe081"], [14, 24, "#c3a5ff"],
      ];
      for (const [px2, py2, petal] of petals) {
        ctx.fillStyle = petal;
        for (const [dx, dy] of [[-3,0],[3,0],[0,-3],[0,3]] as [number,number][]) {
          ctx.beginPath();
          ctx.arc(x + px2 + dx, y + py2 + dy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + px2, y + py2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#2f6d2c";
      ctx.fillRect(x + 8,  y + 13, 1, 4);
      ctx.fillRect(x + 22, y + 19, 1, 4);
      ctx.fillRect(x + 14, y + 27, 1, 3);
      break;
    }
    case "deco_leaves": {
      const colors = [rgbStr(darken(color, 0.8)), rgbStr(lighten(color, 1.2)), "#4f6b2a"];
      for (let i = 0; i < 7; i++) {
        const seed = (x * 23 + y * 17 + i * 37) % 255;
        const lx = seed % (T - 4);
        const ly = (seed * 3) % (T - 4);
        ctx.fillStyle = colors[i % 3];
        ctx.beginPath();
        ctx.ellipse(x + lx, y + ly, 3, 2, (seed % 360) * Math.PI / 180, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "deco_sand": {
      ctx.fillStyle = rgbStr(darken(color, 0.8));
      for (let i = 0; i < 30; i++) {
        const sx = (x * 37 + i * 7) % T;
        const sy = (y * 19 + i * 11) % T;
        ctx.fillRect(x + sx, y + sy, 1, 1);
      }
      ctx.fillStyle = rgbStr(lighten(color, 1.2));
      for (let i = 0; i < 8; i++) {
        const sx = (x * 13 + i * 17) % T;
        const sy = (y * 29 + i * 23) % T;
        ctx.fillRect(x + sx, y + sy, 1, 1);
      }
      break;
    }
    case "deco_gravel": {
      for (let i = 0; i < 14; i++) {
        const seed = (x * 31 + y * 17 + i * 41) % 255;
        const gx = seed % (T - 3);
        const gy = (seed * 3) % (T - 3);
        ctx.fillStyle = i % 2 === 0 ? rgbStr(darken(color, 0.65)) : rgbStr(lighten(color, 1.3));
        ctx.fillRect(x + gx, y + gy, 2, 2);
      }
      break;
    }
    case "deco_rocks": {
      ctx.fillStyle = rgbStr(lighten(color, 1.2));
      for (const [dx, dy, w, h] of [[6,8,5,4],[20,12,6,5],[10,22,4,4],[24,24,5,3]] as [number,number,number,number][]) {
        ctx.fillRect(x + dx, y + dy, w, h);
      }
      ctx.fillStyle = rgbStr(darken(color, 0.55));
      for (const [dx, dy] of [[11,11],[20,12],[14,25],[28,26]] as [number,number][]) {
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
      break;
    }
    case "deco_snow": {
      ctx.fillStyle = "#ffffff";
      for (const [dx, dy] of [[6,8],[16,4],[24,12],[10,20],[22,26],[4,26]] as [number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // cruz do floco
        ctx.fillRect(x + dx - 2, y + dy, 4, 1);
        ctx.fillRect(x + dx, y + dy - 2, 1, 4);
      }
      break;
    }
    case "deco_lava": {
      // bolhas
      for (const [dx, dy, r] of [[8,10,3],[22,14,4],[14,24,3]] as [number,number,number][]) {
        ctx.fillStyle = "#ffdd55";
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + dx - 1, y + dy - 1, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "deco_fire": {
      ctx.fillStyle = "#ffbb33";
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 4);
      ctx.quadraticCurveTo(x + 24, y + 16, x + 16, y + 28);
      ctx.quadraticCurveTo(x + 8, y + 16, x + 16, y + 4);
      ctx.fill();
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 10);
      ctx.quadraticCurveTo(x + 20, y + 18, x + 16, y + 26);
      ctx.quadraticCurveTo(x + 12, y + 18, x + 16, y + 10);
      ctx.fill();
      ctx.fillStyle = "#ffff66";
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 16);
      ctx.quadraticCurveTo(x + 18, y + 22, x + 16, y + 26);
      ctx.quadraticCurveTo(x + 14, y + 22, x + 16, y + 16);
      ctx.fill();
      break;
    }
    case "deco_stars": {
      ctx.fillStyle = "#ffffff";
      for (const [dx, dy] of [[6,6],[24,10],[14,18],[28,22],[4,26],[18,28]] as [number,number][]) {
        ctx.fillRect(x + dx, y + dy, 1, 1);
        ctx.fillRect(x + dx - 1, y + dy, 3, 1);
        ctx.fillRect(x + dx, y + dy - 1, 1, 3);
      }
      ctx.fillStyle = "#ffe88a";
      ctx.fillRect(x + 20, y + 6, 1, 1);
      ctx.fillRect(x + 10, y + 22, 1, 1);
      break;
    }
    case "deco_cloud": {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      for (const [dx, dy, r] of [[10,16,5],[16,12,6],[22,16,5],[16,18,7]] as [number,number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(180,190,210,0.6)";
      for (const [dx, dy, r] of [[10,20,3],[22,20,3]] as [number,number,number][]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}
