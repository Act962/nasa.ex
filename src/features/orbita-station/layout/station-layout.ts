// Montagem da estação e regras de onde o personagem pode pisar. Sem Three.js e sem DOM: roda no
// navegador e no servidor (a validação de posição da loja, spec 0116, usa as mesmas funções).
import { ROOM_KINDS, type RoomKindKey } from "./room-kinds";
import { findTemplate, type StationTemplate } from "./station-templates";

/** Profundidade de cada sala, largura do corredor e vão da porta, em metros. */
export const ROOM_DEPTH = 12;
export const HALL_WIDTH = 6;
export const DOOR_WIDTH = 3;
export const ROOM_GAP_X = 1.4;
export const ROOM_GAP_Z = 1.8;
export const WALL_HEIGHT = 2;
export const FLOOR_TOP = 0.25;
export const ROOM_OFFSET_Z = HALL_WIDTH / 2 + ROOM_GAP_Z + ROOM_DEPTH / 2;
export const PLAYER_RADIUS = 0.38;

export type RoomSide = "top" | "bottom";

export interface RoomLayout {
  key: string;
  kind: RoomKindKey;
  side: RoomSide;
  name: string;
  module: string;
  width: number;
  /** Centro da sala no mundo. */
  cx: number;
  cz: number;
  /** +1 quando a porta fica em +z (fileira de cima), -1 na fileira de baixo. */
  towardDoor: 1 | -1;
  /** z da borda do corredor do lado desta sala. */
  hallEdgeZ: number;
  /** z da parede da sala que tem a porta. */
  doorWallZ: number;
}

export interface StationLayout {
  template: StationTemplate;
  rooms: RoomLayout[];
  hallLength: number;
}

/** Retângulo sólido no piso (centro e meia largura/profundidade). */
export interface Obstacle {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export function resolveLayout(templateKey: string): StationLayout {
  const template = findTemplate(templateKey);
  const rooms: RoomLayout[] = [];
  let hallLength = 0;
  (["top", "bottom"] as const).forEach((side) => {
    const row = template[side];
    const total = row.reduce((sum, [, width]) => sum + width, 0) + ROOM_GAP_X * (row.length - 1);
    hallLength = Math.max(hallLength, total);
    let cursor = -total / 2;
    row.forEach(([kind, width, customName], index) => {
      const towardDoor = side === "top" ? 1 : -1;
      rooms.push({
        key: `${side}-${index}`,
        kind,
        side,
        name: customName ?? ROOM_KINDS[kind].label,
        module: ROOM_KINDS[kind].module,
        width,
        cx: cursor + width / 2,
        cz: side === "top" ? -ROOM_OFFSET_Z : ROOM_OFFSET_Z,
        towardDoor,
        hallEdgeZ: -towardDoor * (HALL_WIDTH / 2),
        doorWallZ: -towardDoor * (HALL_WIDTH / 2 + ROOM_GAP_Z),
      });
      cursor += width + ROOM_GAP_X;
    });
  });
  return { template, rooms, hallLength };
}

function isInRoomInterior(room: RoomLayout, x: number, z: number, margin: number): boolean {
  return Math.abs(x - room.cx) <= room.width / 2 - margin && Math.abs(z - room.cz) <= ROOM_DEPTH / 2 - margin;
}

/** Passagem da porta: da soleira dentro da sala até a borda do corredor. */
function isInDoorway(room: RoomLayout, x: number, z: number): boolean {
  const insideEdge = room.doorWallZ - room.towardDoor * 1.15;
  const hallSide = room.hallEdgeZ + room.towardDoor * 0.4;
  return Math.abs(x - room.cx) <= DOOR_WIDTH / 2 - 0.4 && z >= Math.min(insideEdge, hallSide) && z <= Math.max(insideEdge, hallSide);
}

export function isWalkable(layout: StationLayout, x: number, z: number): boolean {
  if (Math.abs(x) <= layout.hallLength / 2 + 0.6 && Math.abs(z) <= HALL_WIDTH / 2 - 0.35) return true;
  return layout.rooms.some((room) => isInDoorway(room, x, z) || isInRoomInterior(room, x, z, 0.65));
}

export function hitsObstacle(obstacles: readonly Obstacle[], x: number, z: number, radius: number): boolean {
  return obstacles.some((box) => Math.abs(x - box.x) < box.halfWidth + radius && Math.abs(z - box.z) < box.halfDepth + radius);
}

/** Anda eixo por eixo: encostado numa parede, o personagem ainda desliza ao longo dela. */
export function moveWithCollision(
  layout: StationLayout,
  obstacles: readonly Obstacle[],
  position: { x: number; z: number },
  deltaX: number,
  deltaZ: number,
): { x: number; z: number } {
  let { x, z } = position;
  if (isWalkable(layout, x + deltaX, z) && !hitsObstacle(obstacles, x + deltaX, z, PLAYER_RADIUS)) x += deltaX;
  if (isWalkable(layout, x, z + deltaZ) && !hitsObstacle(obstacles, x, z + deltaZ, PLAYER_RADIUS)) z += deltaZ;
  return { x, z };
}

export function roomAt(layout: StationLayout, x: number, z: number): RoomLayout | null {
  return layout.rooms.find((room) => Math.abs(x - room.cx) <= room.width / 2 && Math.abs(z - room.cz) <= ROOM_DEPTH / 2) ?? null;
}

/** Pontos de passagem de uma porta: logo dentro da sala e no meio do corredor, em frente a ela. */
function doorWaypoints(room: RoomLayout) {
  return {
    inside: { x: room.cx, z: room.doorWallZ - room.towardDoor * 1.5 },
    outside: { x: room.cx, z: 0 },
  };
}

/** Caminho em linhas retas até dentro de uma sala: sai pela porta da sala atual, segue o corredor e entra pela outra. */
export function planRouteToRoom(layout: StationLayout, from: { x: number; z: number }, targetRoom: RoomLayout): { x: number; z: number }[] {
  const fromRoom = roomAt(layout, from.x, from.z);
  const target = doorWaypoints(targetRoom);
  if (fromRoom?.key === targetRoom.key) return [target.inside];
  const route: { x: number; z: number }[] = [];
  if (fromRoom) {
    const exit = doorWaypoints(fromRoom);
    route.push(exit.inside, exit.outside);
  }
  route.push(target.outside, target.inside);
  return route;
}

/** Ponto onde o personagem nasce: o centro do círculo do Terminal de Chegada, ou o meio do corredor. */
export function spawnPoint(layout: StationLayout): { x: number; z: number } {
  const terminal = layout.rooms.find((room) => room.kind === "terminal");
  if (!terminal) return { x: 0, z: 0 };
  return { x: terminal.cx, z: terminal.cz + (-terminal.towardDoor * ROOM_DEPTH) / 2 + terminal.towardDoor * 3.4 };
}
