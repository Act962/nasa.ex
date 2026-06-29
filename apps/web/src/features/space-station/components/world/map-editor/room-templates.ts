/**
 * Biblioteca de ambientes prontos para o Map Builder.
 * Cada template gera um TileLayer completo que pode ser aplicado ao canvas.
 */
import type { TileLayer, TileCell, TileTextureKey, TileLayerName } from "../../../types";

export interface RoomTemplate {
  id:          string;
  name:        string;
  category:    string;
  emoji:       string;
  description: string;
  bgColor?:    string;
  generate:    () => TileLayer;
}

/* ─── helpers ─────────────────────────────────────────────────── */

type CellMap = Record<string, TileCell>;

function cell(texture: TileTextureKey, layer: TileLayerName, color?: string): TileCell {
  return { texture, layer, ...(color ? { color } : {}) };
}

function fillRect(
  cells: CellMap, x: number, y: number, w: number, h: number, c: TileCell,
) {
  for (let tx = x; tx < x + w; tx++)
    for (let ty = y; ty < y + h; ty++)
      cells[`${tx},${ty}`] = { ...c };
}

/** Bordas (1 tile de espessura) */
function border(
  cells: CellMap, x: number, y: number, w: number, h: number, c: TileCell,
) {
  fillRect(cells, x, y, w, 1, c);           // top
  fillRect(cells, x, y + h - 1, w, 1, c);  // bottom
  fillRect(cells, x, y, 1, h, c);           // left
  fillRect(cells, x + w - 1, y, 1, h, c);  // right
}

/** Linha horizontal de tiles */
function hline(cells: CellMap, x: number, y: number, w: number, c: TileCell) {
  for (let tx = x; tx < x + w; tx++) cells[`${tx},${y}`] = { ...c };
}

/** Coluna vertical de tiles */
function vline(cells: CellMap, x: number, y: number, h: number, c: TileCell) {
  for (let ty = y; ty < y + h; ty++) cells[`${x},${ty}`] = { ...c };
}

/** Apaga uma abertura (porta) nas paredes */
function door(cells: CellMap, x: number, y: number, w = 2) {
  for (let tx = x; tx < x + w; tx++) delete cells[`${tx},${y}`];
}

function makeLayer(cells: CellMap, bgColor?: string): TileLayer {
  return { gridW: 80, gridH: 50, tileSize: 32, cells, ...(bgColor ? { bgColor } : {}) };
}

/* ─── TEMPLATES ─────────────────────────────────────────────────── */

export const ROOM_TEMPLATES: RoomTemplate[] = [

  /* ── 1. Quarto (Bedroom) ─────────────────────────────── */
  {
    id: "bedroom", name: "Quarto", category: "Residencial", emoji: "🛏️",
    description: "Quarto aconchegante com carpete e decoração floral",
    bgColor: "#0f0a1e",
    generate() {
      const cells: CellMap = {};
      const rx = 20, ry = 8, rw = 30, rh = 22;
      // Piso carpet
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_carpet", "floor", "#7b4f9c"));
      // Tapete central menor em cor diferente
      fillRect(cells, rx + 8, ry + 7, 14, 8, cell("floor_carpet", "floor", "#5c3b80"));
      // Paredes
      border(cells, rx, ry, rw, rh, cell("wall_wood", "wall", "#6b4430"));
      // Porta na parede inferior
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      // Flores decorativas nos cantos interiores
      for (const [dx, dy] of [[1,1],[rw-2,1],[1,rh-2],[rw-2,rh-2]] as [number,number][]) {
        cells[`${rx+dx},${ry+dy}`] = cell("deco_flowers", "decoration", "#e85d94");
      }
      return makeLayer(cells, "#0f0a1e");
    },
  },

  /* ── 2. Sala de Estar (Living Room) ──────────────────── */
  {
    id: "living_room", name: "Sala de Estar", category: "Residencial", emoji: "🛋️",
    description: "Sala espaçosa com piso de madeira e área de tapete",
    bgColor: "#12100a",
    generate() {
      const cells: CellMap = {};
      const rx = 14, ry = 5, rw = 40, rh = 28;
      // Piso de madeira
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_wood", "floor", "#a0783c"));
      // Tapete central
      fillRect(cells, rx + 8, ry + 7, 24, 14, cell("floor_carpet", "floor", "#3d5a8a"));
      // Paredes madeira
      border(cells, rx, ry, rw, rh, cell("wall_wood", "wall", "#6b4430"));
      // Janelas (parede de vidro) na frente (topo)
      for (let tx = rx + 4; tx < rx + rw - 4; tx += 5) {
        cells[`${tx},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
        cells[`${tx+1},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
      }
      // Porta sul
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      // Porta lateral
      door(cells, rx, ry + rh / 2, 2);
      // Arbustos decorativos nos cantos
      cells[`${rx+2},${ry+2}`] = cell("deco_bushes", "decoration", "#2d7328");
      cells[`${rx+rw-3},${ry+2}`] = cell("deco_bushes", "decoration", "#2d7328");
      return makeLayer(cells, "#12100a");
    },
  },

  /* ── 3. Cozinha (Kitchen) ────────────────────────────── */
  {
    id: "kitchen", name: "Cozinha", category: "Residencial", emoji: "🍳",
    description: "Cozinha moderna com bancadas em L e piso azulejado",
    bgColor: "#0a0f14",
    generate() {
      const cells: CellMap = {};
      const rx = 22, ry = 8, rw = 28, rh = 22;
      // Piso azulejo branco
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_tile_white", "floor", "#eeeeee"));
      // Paredes concreto
      border(cells, rx, ry, rw, rh, cell("wall_concrete", "wall", "#909090"));
      // Bancada em L (lado esquerdo + topo interno)
      hline(cells, rx + 1, ry + 1, 4, cell("wall_concrete", "wall", "#707070"));
      hline(cells, rx + 1, ry + 2, 4, cell("wall_concrete", "wall", "#707070"));
      hline(cells, rx + 1, ry + 3, 4, cell("wall_concrete", "wall", "#707070"));
      // Bancada superior
      hline(cells, rx + 1, ry + 1, rw - 2, cell("wall_concrete", "wall", "#707070"));
      hline(cells, rx + 1, ry + 2, rw - 2, cell("wall_concrete", "wall", "#707070"));
      // Piso xadrez numa sub-área
      fillRect(cells, rx + 6, ry + 5, 8, 6, cell("floor_checker", "floor", "#ffffff"));
      // Poça/pia
      cells[`${rx+2},${ry+5}`] = cell("deco_puddle", "decoration", "#5ba7d9");
      cells[`${rx+3},${ry+5}`] = cell("deco_puddle", "decoration", "#5ba7d9");
      // Porta
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      return makeLayer(cells, "#0a0f14");
    },
  },

  /* ── 4. Escritório Open Space ────────────────────────── */
  {
    id: "office_open", name: "Escritório", category: "Corporativo", emoji: "💼",
    description: "Espaço de trabalho aberto com piso tech e zonas de carpete",
    bgColor: "#060a0f",
    generate() {
      const cells: CellMap = {};
      const rx = 8, ry = 5, rw = 55, rh = 32;
      // Piso base: concreto
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_concrete", "floor", "#9a9a9a"));
      // Zonas de carpete para equipes
      fillRect(cells, rx + 3, ry + 3, 16, 10, cell("floor_carpet", "floor", "#3d6a8a"));
      fillRect(cells, rx + 23, ry + 3, 16, 10, cell("floor_carpet", "floor", "#4a3d8a"));
      fillRect(cells, rx + 3, ry + 17, 16, 10, cell("floor_carpet", "floor", "#3d8a5f"));
      fillRect(cells, rx + 23, ry + 17, 16, 10, cell("floor_carpet", "floor", "#8a4d3d"));
      // Zona tech central
      fillRect(cells, rx + 43, ry + 3, 8, 24, cell("floor_tech", "floor", "#1d3b66"));
      // Paredes metal
      border(cells, rx, ry, rw, rh, cell("wall_metal", "wall", "#6c7a90"));
      // Portas
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      door(cells, rx, ry + rh / 2, 2);
      // Decorações
      for (let tx = rx + 5; tx < rx + rw - 5; tx += 12) {
        cells[`${tx},${ry+2}`] = cell("deco_bushes", "decoration", "#2d7328");
      }
      return makeLayer(cells, "#060a0f");
    },
  },

  /* ── 5. Banheiro (Bathroom) ─────────────────────────── */
  {
    id: "bathroom", name: "Banheiro", category: "Residencial", emoji: "🚿",
    description: "Banheiro com azulejo e piso impermeável",
    bgColor: "#060d14",
    generate() {
      const cells: CellMap = {};
      const rx = 32, ry = 14, rw = 14, rh = 14;
      // Piso azulejo
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_tile_white", "floor", "#e8e8f0"));
      // Paredes
      border(cells, rx, ry, rw, rh, cell("wall_concrete", "wall", "#909090"));
      // Xadrez pequeno no centro
      fillRect(cells, rx + 3, ry + 3, 8, 8, cell("floor_checker", "floor", "#f0f0f0"));
      // Poças (chuveiro/pia)
      cells[`${rx+2},${ry+2}`] = cell("deco_puddle", "decoration", "#5ba7d9");
      cells[`${rx+rw-3},${ry+2}`] = cell("deco_puddle", "decoration", "#5ba7d9");
      cells[`${rx+2},${ry+rh-3}`] = cell("deco_puddle", "decoration", "#5ba7d9");
      // Porta
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 2);
      return makeLayer(cells, "#060d14");
    },
  },

  /* ── 6. Corredor (Hallway) ───────────────────────────── */
  {
    id: "hallway", name: "Corredor", category: "Circulação", emoji: "🚪",
    description: "Corredor longo com saídas nas extremidades",
    bgColor: "#0a0a0a",
    generate() {
      const cells: CellMap = {};
      const ry = 20, rh = 8;
      // Piso escuro do corredor
      fillRect(cells, 1, ry + 1, 78, rh - 2, cell("floor_tile_dark", "floor", "#2e2e3a"));
      // Borda azulejo nas bordas internas
      hline(cells, 1, ry + 2, 78, cell("floor_tile_white", "floor", "#cccccc"));
      hline(cells, 1, ry + rh - 3, 78, cell("floor_tile_white", "floor", "#cccccc"));
      // Paredes
      hline(cells, 0, ry, 80, cell("wall_concrete", "wall", "#808080"));
      hline(cells, 0, ry + rh - 1, 80, cell("wall_concrete", "wall", "#808080"));
      // Portas a cada 15 tiles
      for (let tx = 10; tx < 75; tx += 15) {
        door(cells, tx, ry, 3);
        door(cells, tx, ry + rh - 1, 3);
      }
      // Decorações nas paredes
      for (let tx = 5; tx < 78; tx += 10) {
        cells[`${tx},${ry+1}`] = cell("deco_flowers", "decoration", "#c3a5ff");
      }
      return makeLayer(cells, "#0a0a0a");
    },
  },

  /* ── 7. Jardim (Garden) ─────────────────────────────── */
  {
    id: "garden", name: "Jardim", category: "Exterior", emoji: "🌳",
    description: "Jardim externo com caminhos de pedra e vegetação",
    bgColor: "#0a1a0a",
    generate() {
      const cells: CellMap = {};
      // Base de grama cobrindo o mapa todo
      fillRect(cells, 0, 0, 80, 50, cell("floor_grass", "floor", "#4a9f3c"));
      // Caminho central horizontal em pedra
      fillRect(cells, 10, 22, 60, 4, cell("floor_stone", "floor", "#7a7a7a"));
      // Caminho vertical em pedra
      fillRect(cells, 37, 5, 4, 40, cell("floor_stone", "floor", "#7a7a7a"));
      // Canteiros com flores
      for (const [cx, cy, w, h] of [
        [4, 4, 8, 8], [64, 4, 8, 8],
        [4, 36, 8, 8], [64, 36, 8, 8],
        [20, 10, 6, 6], [50, 10, 6, 6],
        [20, 32, 6, 6], [50, 32, 6, 6],
      ] as [number,number,number,number][]) {
        fillRect(cells, cx, cy, w, h, cell("deco_flowers", "decoration", "#e85d94"));
        border(cells, cx, cy, w, h, cell("wall_stone", "wall", "#707070"));
      }
      // Arbustos
      for (const [bx, by] of [[15,5],[62,5],[15,42],[62,42],[30,10],[46,10]] as [number,number][]) {
        cells[`${bx},${by}`] = cell("deco_bushes", "decoration", "#2d7328");
      }
      // Água central (lago pequeno)
      fillRect(cells, 24, 23, 6, 5, cell("deco_water", "decoration", "#3a8fd4"));
      border(cells, 23, 22, 8, 7, cell("wall_stone", "wall", "#6a7a60"));
      return makeLayer(cells, "#0a1a0a");
    },
  },

  /* ── 8. Recepção (Reception) ─────────────────────────── */
  {
    id: "reception", name: "Recepção", category: "Corporativo", emoji: "🏢",
    description: "Área de recepção com balcão de mármore e cadeiras de espera",
    bgColor: "#0a0a12",
    generate() {
      const cells: CellMap = {};
      const rx = 12, ry = 6, rw = 44, rh = 30;
      // Piso mármore
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_marble", "floor", "#e8e4dd"));
      // Área de espera: carpete
      fillRect(cells, rx + 2, ry + 14, 14, 12, cell("floor_carpet", "floor", "#4a5c7a"));
      // Balcão de atendimento (paredes concreto em U)
      hline(cells, rx + 22, ry + 5, 16, cell("wall_concrete", "wall", "#606070"));
      hline(cells, rx + 22, ry + 6, 16, cell("wall_concrete", "wall", "#606070"));
      vline(cells, rx + 22, ry + 5, 8, cell("wall_concrete", "wall", "#606070"));
      vline(cells, rx + 37, ry + 5, 8, cell("wall_concrete", "wall", "#606070"));
      // Piso tech na área do balcão
      fillRect(cells, rx + 23, ry + 7, 14, 5, cell("floor_tech", "floor", "#1d3b66"));
      // Paredes pedra
      border(cells, rx, ry, rw, rh, cell("wall_stone", "wall", "#7a7a7a"));
      // Janelas na frente (topo)
      for (let tx = rx + 3; tx < rx + rw - 3; tx += 6) {
        cells[`${tx},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
        cells[`${tx+1},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
        cells[`${tx+2},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
      }
      // Porta principal (dupla)
      door(cells, rx + rw / 2 - 2, ry + rh - 1, 5);
      // Plantas decorativas
      for (const [dx, dy] of [[2,2],[2,rh-3],[rw-3,2],[rw-3,rh-3]] as [number,number][]) {
        cells[`${rx+dx},${ry+dy}`] = cell("deco_bushes", "decoration", "#2d7328");
      }
      return makeLayer(cells, "#0a0a12");
    },
  },

  /* ── 9. Auditório ────────────────────────────────────── */
  {
    id: "auditorium", name: "Auditório", category: "Corporativo", emoji: "🎭",
    description: "Auditório com palco de madeira e fileiras de carpete",
    bgColor: "#08080f",
    generate() {
      const cells: CellMap = {};
      const rx = 6, ry = 3, rw = 58, rh = 38;
      // Piso geral carpete escuro
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_carpet", "floor", "#2d2d6a"));
      // Palco: madeira na base
      fillRect(cells, rx + 8, ry + 24, rw - 16, 10, cell("floor_wood", "floor", "#a07840"));
      // Linha da borda do palco
      hline(cells, rx + 8, ry + 24, rw - 16, cell("wall_concrete", "wall", "#505050"));
      // Corredor central (fileiras)
      fillRect(cells, rx + rw / 2 - 2, ry + 2, 4, 20, cell("floor_tile_dark", "floor", "#1a1a2e"));
      // Corredores laterais
      fillRect(cells, rx + 2, ry + 2, 3, 20, cell("floor_tile_dark", "floor", "#1a1a2e"));
      fillRect(cells, rx + rw - 5, ry + 2, 3, 20, cell("floor_tile_dark", "floor", "#1a1a2e"));
      // Paredes concreto
      border(cells, rx, ry, rw, rh, cell("wall_concrete", "wall", "#808080"));
      // Paredes tech laterais
      for (let ty = ry + 2; ty < ry + 24; ty += 3) {
        cells[`${rx+1},${ty}`] = cell("wall_tech", "wall", "#0f2a4a");
        cells[`${rx+rw-2},${ty}`] = cell("wall_tech", "wall", "#0f2a4a");
      }
      // Estrelas no teto (decoração no fundo do palco)
      for (let tx = rx + 10; tx < rx + rw - 10; tx += 4) {
        cells[`${tx},${ry+25}`] = cell("deco_stars", "decoration", "#0b0b2a");
        cells[`${tx+2},${ry+30}`] = cell("deco_stars", "decoration", "#0b0b2a");
      }
      // Portas
      door(cells, rx + rw / 2 - 2, ry + rh - 1, 5);
      door(cells, rx, ry + 10, 2);
      door(cells, rx + rw - 1, ry + 10, 2);
      return makeLayer(cells, "#08080f");
    },
  },

  /* ── 10. Sala de Reunião (Meeting Room) ──────────────── */
  {
    id: "meeting_room", name: "Sala de Reunião", category: "Corporativo", emoji: "📊",
    description: "Sala de reunião com paredes de vidro e piso tech",
    bgColor: "#050a10",
    generate() {
      const cells: CellMap = {};
      const rx = 25, ry = 10, rw = 26, rh = 20;
      // Piso carpete
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_carpet", "floor", "#303060"));
      // Mesa central (tech)
      fillRect(cells, rx + 6, ry + 5, rw - 12, rh - 10, cell("floor_tech", "floor", "#1d3b66"));
      // Paredes vidro nos 4 lados
      border(cells, rx, ry, rw, rh, cell("wall_glass", "wall", "#7bc6e8"));
      // Moldura metal nas quinas
      for (const [dx, dy] of [[0,0],[rw-1,0],[0,rh-1],[rw-1,rh-1]] as [number,number][]) {
        cells[`${rx+dx},${ry+dy}`] = cell("wall_metal", "wall", "#6c7a90");
      }
      // Porta (vidro abrindo no lado direito)
      door(cells, rx + rw - 1, ry + rh / 2 - 1, 2);
      // Telas (tech nas paredes internas)
      cells[`${rx+rw/2|0},${ry+1}`] = cell("wall_tech", "wall", "#0f2a4a");
      return makeLayer(cells, "#050a10");
    },
  },

  /* ── 11. Copa / Cafeteria ────────────────────────────── */
  {
    id: "cafeteria", name: "Copa / Cafeteria", category: "Corporativo", emoji: "☕",
    description: "Copa com area de café, pia e mesas",
    bgColor: "#0c0a06",
    generate() {
      const cells: CellMap = {};
      const rx = 18, ry = 7, rw = 34, rh = 24;
      // Piso azulejo branco
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_tile_white", "floor", "#f0f0f0"));
      // Zona de cafezinho: xadrez
      fillRect(cells, rx + 2, ry + 2, 8, 8, cell("floor_checker", "floor", "#e0e0e0"));
      // Balcão de serviço (parede concreto horizontal no topo)
      hline(cells, rx + 1, ry + 1, rw - 2, cell("wall_concrete", "wall", "#707070"));
      hline(cells, rx + 1, ry + 2, rw - 2, cell("wall_concrete", "wall", "#707070"));
      // Pia (poça)
      for (const [dx, dy] of [[2,4],[3,4],[12,4],[13,4]] as [number,number][]) {
        cells[`${rx+dx},${ry+dy}`] = cell("deco_puddle", "decoration", "#5ba7d9");
      }
      // Área de mesas: carpete
      fillRect(cells, rx + 4, ry + 12, rw - 8, 8, cell("floor_carpet", "floor", "#5c3b20"));
      // Paredes
      border(cells, rx, ry, rw, rh, cell("wall_concrete", "wall", "#808080"));
      // Janelas laterais
      for (let tx = rx + 4; tx < rx + rw - 4; tx += 6) {
        cells[`${tx},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
        cells[`${tx+1},${ry}`] = cell("wall_glass", "wall", "#7bc6e8");
      }
      // Porta
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      // Plantas
      cells[`${rx+2},${ry+rh-3}`] = cell("deco_bushes", "decoration", "#2d7328");
      cells[`${rx+rw-3},${ry+rh-3}`] = cell("deco_bushes", "decoration", "#2d7328");
      return makeLayer(cells, "#0c0a06");
    },
  },

  /* ── 12. Laboratório (Lab) ───────────────────────────── */
  {
    id: "laboratory", name: "Laboratório", category: "Especial", emoji: "🔬",
    description: "Laboratório com piso tech, paredes de circuito e mesas de equipamentos",
    bgColor: "#020a10",
    generate() {
      const cells: CellMap = {};
      const rx = 8, ry = 5, rw = 52, rh = 32;
      // Piso metal base
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_metal", "floor", "#506070"));
      // Zonas tech
      fillRect(cells, rx + 3, ry + 3, 14, 8, cell("floor_tech", "floor", "#1d3b66"));
      fillRect(cells, rx + 21, ry + 3, 14, 8, cell("floor_tech", "floor", "#1d3b66"));
      fillRect(cells, rx + 39, ry + 3, 8, 8, cell("floor_tech", "floor", "#1a3a20"));
      fillRect(cells, rx + 3, ry + 18, 14, 8, cell("floor_tech", "floor", "#2d1a3a"));
      fillRect(cells, rx + 21, ry + 18, 14, 8, cell("floor_tech", "floor", "#1d3b66"));
      fillRect(cells, rx + 39, ry + 18, 8, 8, cell("floor_tech", "floor", "#3a1a1a"));
      // Paredes tech
      border(cells, rx, ry, rw, rh, cell("wall_tech", "wall", "#0f2a4a"));
      // Separadores internos (bancadas/mesas)
      hline(cells, rx + 3, ry + 13, rw - 6, cell("wall_metal", "wall", "#5a6878"));
      // Circuitos nas paredes internas
      for (let ty = ry + 2; ty < ry + rh - 2; ty += 3) {
        cells[`${rx+1},${ty}`] = cell("wall_tech", "wall", "#0f2a4a");
        cells[`${rx+rw-2},${ty}`] = cell("wall_tech", "wall", "#0f2a4a");
      }
      // Portas
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      door(cells, rx, ry + rh / 2 - 1, 2);
      // Estrelas (partículas de pesquisa)
      for (const [dx, dy] of [[5,15],[22,15],[40,15]] as [number,number][]) {
        cells[`${rx+dx},${ry+dy}`] = cell("deco_stars", "decoration", "#0b0b2a");
      }
      return makeLayer(cells, "#020a10");
    },
  },

  /* ── 13. Cidade / Área Externa ───────────────────────── */
  {
    id: "city_street", name: "Rua da Cidade", category: "Exterior", emoji: "🌆",
    description: "Área urbana com calçadas, rua central e áreas verdes",
    bgColor: "#0a0a0a",
    generate() {
      const cells: CellMap = {};
      // Calçadas (concreto) nas laterais
      fillRect(cells, 0, 0, 80, 8, cell("floor_concrete", "floor", "#b0b0b0"));
      fillRect(cells, 0, 42, 80, 8, cell("floor_concrete", "floor", "#b0b0b0"));
      // Rua central (pedra escura)
      fillRect(cells, 0, 8, 80, 34, cell("floor_stone", "floor", "#5a5a5a"));
      // Faixas da rua
      for (let tx = 5; tx < 75; tx += 6) {
        fillRect(cells, tx, 24, 3, 2, cell("floor_tile_white", "floor", "#f0f0f0"));
      }
      // Calçadas verticais
      fillRect(cells, 0, 8, 6, 34, cell("floor_cobble", "floor", "#8a8a8a"));
      fillRect(cells, 74, 8, 6, 34, cell("floor_cobble", "floor", "#8a8a8a"));
      // Grama nas esquinas
      fillRect(cells, 0, 0, 8, 8, cell("floor_grass", "floor", "#4a9f3c"));
      fillRect(cells, 72, 0, 8, 8, cell("floor_grass", "floor", "#4a9f3c"));
      fillRect(cells, 0, 42, 8, 8, cell("floor_grass", "floor", "#4a9f3c"));
      fillRect(cells, 72, 42, 8, 8, cell("floor_grass", "floor", "#4a9f3c"));
      // Árvores nos cantos
      for (const [tx, ty] of [[2,2],[74,2],[2,44],[74,44],[3,10],[3,38],[73,10],[73,38]] as [number,number][]) {
        cells[`${tx},${ty}`] = cell("deco_bushes", "decoration", "#2d7328");
      }
      // Paralelepípedo nas calçadas
      fillRect(cells, 6, 8, 2, 34, cell("wall_stone", "wall", "#606060"));
      fillRect(cells, 72, 8, 2, 34, cell("wall_stone", "wall", "#606060"));
      return makeLayer(cells, "#0a0a0a");
    },
  },

  /* ── 14. Loja / Store ────────────────────────────────── */
  {
    id: "store", name: "Loja", category: "Comercial", emoji: "🛒",
    description: "Loja comercial com vitrine de vidro e piso de mármore",
    bgColor: "#0a080a",
    generate() {
      const cells: CellMap = {};
      const rx = 16, ry = 6, rw = 38, rh = 26;
      // Piso mármore
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_marble", "floor", "#e8e4dd"));
      // Área de estoque no fundo: concreto
      fillRect(cells, rx + 2, ry + 18, rw - 4, 6, cell("floor_concrete", "floor", "#aaaaaa"));
      // Separador de estoque
      hline(cells, rx + 2, ry + 18, rw - 4, cell("wall_concrete", "wall", "#707070"));
      // Paredes tijolo nos lados e fundo
      border(cells, rx, ry, rw, rh, cell("wall_brick", "wall", "#c05030"));
      // Vitrine de vidro na frente (substituindo paredes de tijolo)
      hline(cells, rx + 2, ry, rw - 4, cell("wall_glass", "wall", "#7bc6e8"));
      // Porta dupla de entrada
      door(cells, rx + rw / 2 - 2, ry, 5);
      // Porta dos fundos
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      // Balcão de caixa (concreto em L)
      hline(cells, rx + 4, ry + 14, 8, cell("wall_concrete", "wall", "#606060"));
      vline(cells, rx + 4, ry + 14, 4, cell("wall_concrete", "wall", "#606060"));
      // Prateleiras internas (wall_wood)
      for (let ty = ry + 3; ty < ry + 14; ty += 4) {
        hline(cells, rx + 24, ty, 10, cell("wall_wood", "wall", "#8b6040"));
      }
      // Flores decorativas
      for (const [dx, dy] of [[2,2],[rw-3,2],[2,rh-3]] as [number,number][]) {
        cells[`${rx+dx},${ry+dy}`] = cell("deco_flowers", "decoration", "#e85d94");
      }
      return makeLayer(cells, "#0a080a");
    },
  },

  /* ── 15. Espaço Sideral (Space) ─────────────────────── */
  {
    id: "space_station", name: "Estação Espacial", category: "Especial", emoji: "🚀",
    description: "Módulo espacial com piso tech e compartimentos pressurizados",
    bgColor: "#010308",
    generate() {
      const cells: CellMap = {};
      const rx = 5, ry = 3, rw = 60, rh = 40;
      // Módulo principal: piso metal
      fillRect(cells, rx + 1, ry + 1, rw - 2, rh - 2, cell("floor_metal", "floor", "#4a5a6a"));
      // Compartimentos laterais
      fillRect(cells, rx + 3, ry + 3, 10, 14, cell("floor_tech", "floor", "#1d3b66"));
      fillRect(cells, rx + rw - 13, ry + 3, 10, 14, cell("floor_tech", "floor", "#1d3b66"));
      fillRect(cells, rx + 3, ry + 23, 10, 12, cell("floor_tech", "floor", "#1a3a20"));
      fillRect(cells, rx + rw - 13, ry + 23, 10, 12, cell("floor_tech", "floor", "#2d1a3a"));
      // Corredor central
      fillRect(cells, rx + 16, ry + 3, rw - 32, rh - 6, cell("floor_metal", "floor", "#5a6a7a"));
      // Painel de controle central
      fillRect(cells, rx + rw / 2 - 6, ry + rh / 2 - 4, 12, 8, cell("floor_tech", "floor", "#1d3b66"));
      // Paredes metal
      border(cells, rx, ry, rw, rh, cell("wall_metal", "wall", "#6c7a90"));
      // Separadores internos
      vline(cells, rx + 14, ry + 1, rh - 2, cell("wall_metal", "wall", "#5a6878"));
      vline(cells, rx + rw - 15, ry + 1, rh - 2, cell("wall_metal", "wall", "#5a6878"));
      // Estrelas ao fundo
      for (let tx = rx + 17; tx < rx + rw - 16; tx += 3) {
        cells[`${tx},${ry+2}`] = cell("deco_stars", "decoration", "#0b0b2a");
        cells[`${tx+1},${ry+rh-3}`] = cell("deco_stars", "decoration", "#0b0b2a");
      }
      // Portas de acesso (airlocks)
      door(cells, rx + 14, ry + rh / 2 - 1, 2);
      door(cells, rx + rw - 15, ry + rh / 2 - 1, 2);
      door(cells, rx + rw / 2 - 1, ry + rh - 1, 3);
      return makeLayer(cells, "#010308");
    },
  },
];

/* ─── Agrupamentos por categoria ─────────────────────────────── */

export const ROOM_CATEGORIES = [...new Set(ROOM_TEMPLATES.map(t => t.category))];

export function getTemplatesByCategory(category: string) {
  return ROOM_TEMPLATES.filter(t => t.category === category);
}
