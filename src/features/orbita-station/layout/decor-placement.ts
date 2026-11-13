// Regra de onde um item de decoração pode ficar (spec 0118, RF-9 e D-7). Função pura: a prévia no navegador e as
// procedures no servidor usam exatamente a mesma, para as duas nunca discordarem.
import { findDecorItem, type DecorItem } from "./decor-catalog";
import { CHAT_QUEUE_SPOTS, chatQueueSpot, stationObstacles } from "./room-furniture";
import {
  DOOR_WIDTH,
  HALL_WIDTH,
  ROOM_DEPTH,
  roomAt,
  spawnPoint,
  type Obstacle,
  type RoomOpenCheck,
  type StationLayout,
} from "./station-layout";

export const MAX_ITEMS_PER_STATION = 300;

export type PlacementProblem = "UNKNOWN_ITEM" | "INVALID_TRANSFORM" | "OUT_OF_BOUNDS" | "ROOM_LOCKED" | "BLOCKED_AREA" | "OVERLAPS_ITEM" | "BLOCKS_PASSAGE";

export const PLACEMENT_PROBLEM_TEXT: Record<PlacementProblem, string> = {
  UNKNOWN_ITEM: "Item fora do catálogo",
  INVALID_TRANSFORM: "Giro inválido",
  OUT_OF_BOUNDS: "Fora do piso",
  ROOM_LOCKED: "Sala sem acesso para você",
  BLOCKED_AREA: "Em cima de um móvel ou de uma área reservada",
  OVERLAPS_ITEM: "Em cima de outro item",
  BLOCKS_PASSAGE: "Bloqueia uma porta ou a passagem do corredor",
};

/** Item já colocado, no formato que a regra precisa. */
export interface PlacedDecor {
  id: string;
  itemKey: string;
  x: number;
  z: number;
  quarterTurns: number;
}

export interface PlacementCandidate {
  itemKey: string;
  x: number;
  z: number;
  quarterTurns: number;
  /** Mover: o próprio item não conta como sobreposição. */
  ignoreId?: string;
}

export type PlacementResult = { ok: true } | { ok: false; problem: PlacementProblem };

/** Meia largura e meia profundidade da pegada, já com o giro (quartos de volta ímpares trocam os lados). */
export function decorHalfExtents(item: DecorItem, quarterTurns: number) {
  const isSideways = quarterTurns % 2 === 1;
  return { halfWidth: (isSideways ? item.depth : item.width) / 2, halfDepth: (isSideways ? item.width : item.depth) / 2 };
}

/** Retângulo que bloqueia o personagem. Tapete não bloqueia. */
export function decorObstacle(placed: PlacedDecor): Obstacle | null {
  const item = findDecorItem(placed.itemKey);
  if (!item || item.isWalkable) return null;
  return { x: placed.x, z: placed.z, ...decorHalfExtents(item, placed.quarterTurns) };
}

const overlaps = (first: Obstacle, second: Obstacle) =>
  Math.abs(first.x - second.x) < first.halfWidth + second.halfWidth && Math.abs(first.z - second.z) < first.halfDepth + second.halfDepth;

/** Áreas onde nada pode ficar: portas, a faixa do meio do corredor, o círculo de chegada e a fila do chat. */
function reservedAreas(layout: StationLayout): { area: Obstacle; problem: PlacementProblem }[] {
  const areas: { area: Obstacle; problem: PlacementProblem }[] = [];
  areas.push({ area: { x: 0, z: 0, halfWidth: layout.hallLength / 2 + 2, halfDepth: 1.5 }, problem: "BLOCKS_PASSAGE" });
  layout.rooms.forEach((room) => {
    // Da metade do corredor até 2,4 m para dentro da sala, na largura da porta e com folga.
    const insideZ = room.doorWallZ - room.towardDoor * 2.4;
    const minZ = Math.min(insideZ, 0);
    const maxZ = Math.max(insideZ, 0);
    areas.push({ area: { x: room.cx, z: (minZ + maxZ) / 2, halfWidth: DOOR_WIDTH / 2 + 0.5, halfDepth: (maxZ - minZ) / 2 }, problem: "BLOCKS_PASSAGE" });
    if (room.kind === "chat") {
      const first = chatQueueSpot(room, 0);
      const last = chatQueueSpot(room, CHAT_QUEUE_SPOTS - 1);
      areas.push({
        area: { x: (first.x + last.x) / 2, z: (first.z + last.z) / 2, halfWidth: Math.abs(last.x - first.x) / 2 + 1, halfDepth: Math.abs(last.z - first.z) / 2 + 1 },
        problem: "BLOCKED_AREA",
      });
    }
  });
  const spawn = spawnPoint(layout);
  areas.push({ area: { x: spawn.x, z: spawn.z, halfWidth: 2.2, halfDepth: 2.2 }, problem: "BLOCKED_AREA" });
  return areas;
}

/** O ponto está no piso? E, se estiver numa sala, ela está aberta para quem coloca? */
function floorAt(layout: StationLayout, x: number, z: number, isRoomOpen: RoomOpenCheck): "ok" | "out" | "locked" {
  if (Math.abs(x) <= layout.hallLength / 2 + 0.6 && Math.abs(z) <= HALL_WIDTH / 2 - 0.2) return "ok";
  const room = roomAt(layout, x, z);
  if (!room) return "out";
  // Por dentro das paredes (0,2 m de espessura).
  if (Math.abs(x - room.cx) > room.width / 2 - 0.25 || Math.abs(z - room.cz) > ROOM_DEPTH / 2 - 0.25) return "out";
  return isRoomOpen(room) ? "ok" : "locked";
}

export interface PlacementContext {
  layout: StationLayout;
  /** Móveis fixos (`stationObstacles`). Recebido de fora para não recalcular a cada movimento do cursor. */
  fixedObstacles: readonly Obstacle[];
  placed: readonly PlacedDecor[];
  isRoomOpen: RoomOpenCheck;
}

export function createPlacementContext(layout: StationLayout, placed: readonly PlacedDecor[], isRoomOpen: RoomOpenCheck): PlacementContext {
  return { layout, fixedObstacles: stationObstacles(layout.rooms), placed, isRoomOpen };
}

export function validatePlacement(context: PlacementContext, candidate: PlacementCandidate): PlacementResult {
  const item = findDecorItem(candidate.itemKey);
  if (!item || item.retired) return { ok: false, problem: "UNKNOWN_ITEM" };
  if (!Number.isInteger(candidate.quarterTurns) || candidate.quarterTurns < 0 || candidate.quarterTurns > 3) return { ok: false, problem: "INVALID_TRANSFORM" };
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) return { ok: false, problem: "OUT_OF_BOUNDS" };
  const footprint: Obstacle = { x: candidate.x, z: candidate.z, ...decorHalfExtents(item, candidate.quarterTurns) };

  // Cantos, meio das bordas e centro: todos no piso. Uma sala trancada no meio do caminho é o motivo mais útil.
  let floorProblem: PlacementProblem | null = null;
  for (const factorX of [-1, 0, 1]) {
    for (const factorZ of [-1, 0, 1]) {
      const state = floorAt(context.layout, footprint.x + factorX * footprint.halfWidth, footprint.z + factorZ * footprint.halfDepth, context.isRoomOpen);
      if (state === "locked") return { ok: false, problem: "ROOM_LOCKED" };
      if (state === "out") floorProblem = "OUT_OF_BOUNDS";
    }
  }
  if (floorProblem) return { ok: false, problem: floorProblem };
  // Tapete fica no chão: pode ir para baixo de móvel, de outro item e até no corredor.
  if (item.isWalkable) return { ok: true };

  for (const { area, problem } of reservedAreas(context.layout)) {
    if (overlaps(footprint, area)) return { ok: false, problem };
  }
  if (context.fixedObstacles.some((obstacle) => overlaps(footprint, obstacle))) return { ok: false, problem: "BLOCKED_AREA" };
  for (const other of context.placed) {
    if (other.id === candidate.ignoreId) continue;
    const obstacle = decorObstacle(other);
    if (obstacle && overlaps(footprint, obstacle)) return { ok: false, problem: "OVERLAPS_ITEM" };
  }
  return { ok: true };
}
