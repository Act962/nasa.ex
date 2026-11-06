// Onde ficam os móveis fixos de cada sala, sem Three.js: a colisão do personagem, o caminho do "Ir até" e a
// validação dos itens de decoração no servidor (spec 0118, D-7) leem a mesma lista. `engine/furnish-room.ts` desenha
// os móveis nestas mesmas posições — mudar um móvel de lugar é mudar aqui e lá.
import { ROOM_DEPTH, doorWaypoints, type Obstacle, type RoomLayout } from "./station-layout";

/** Planta decorativa dos cantos do fundo: só entra onde não bate em móvel nem em cadeira. */
export interface CornerPlant {
  x: number;
  z: number;
  model: "cactus_medium_A" | "cactus_medium_B";
}

export interface RoomFurniture {
  /** Retângulos sólidos no mundo. */
  obstacles: Obstacle[];
  /** Posições locais (relativas ao centro da sala) das plantas dos cantos. */
  plants: CornerPlant[];
}

/** Fileira de posições x centrada na sala, com o espaçamento e a margem pedidos. */
export function roomColumns(room: RoomLayout, spacing: number, margin = 1.6): number[] {
  const count = Math.max(1, Math.floor((room.width - margin * 2) / spacing) + 1);
  const span = (count - 1) * spacing;
  return Array.from({ length: count }, (_, index) => -span / 2 + index * spacing);
}

/** z local a partir da parede do fundo (oposta à porta). */
export function fromBackZ(room: RoomLayout, fromBack: number): number {
  return (-room.towardDoor * ROOM_DEPTH) / 2 + room.towardDoor * fromBack;
}

/** Balcão do NasaChat: as medidas que o desenho e a colisão usam. */
export function chatCounter(room: RoomLayout) {
  const halfWidth = room.width / 2;
  const passage = 2.2;
  const left = -halfWidth + 0.45;
  const right = halfWidth - 0.45 - passage;
  const length = right - left;
  const attendantCount = Math.max(2, Math.round(length / 3));
  return { left, right, length, centerX: (left + right) / 2, fromBack: 2.4, depth: 1, attendantCount, slot: length / attendantCount };
}

/** Fileiras das cadeiras de espera do NasaChat (posições locais). */
export function chatWaitingChairs(room: RoomLayout): { x: number; z: number }[] {
  const halfWidth = room.width / 2;
  const chairs: { x: number; z: number }[] = [];
  [5.3, 6.9, 8.5].forEach((fromBack) => {
    for (let x = -halfWidth + 1.2; x <= halfWidth - 1.6; x += 1.35) {
      if (Math.abs(x) < 1.5) continue;
      chairs.push({ x, z: fromBackZ(room, fromBack) });
    }
  });
  return chairs;
}

export function roomFurniture(room: RoomLayout): RoomFurniture {
  const obstacles: Obstacle[] = [];
  const chairSpots: { x: number; z: number }[] = [];
  const halfWidth = room.width / 2;
  const back = (fromBack: number) => fromBackZ(room, fromBack);
  const solid = (x: number, z: number, width: number, depth: number) =>
    obstacles.push({ x: room.cx + x, z: room.cz + z, halfWidth: width / 2, halfDepth: depth / 2 });
  const chair = (x: number, fromBack: number) => chairSpots.push({ x, z: back(fromBack) });
  const workstation = (x: number, fromBack: number) => {
    solid(x, back(fromBack), 2, 1);
    chair(x, fromBack + 1);
  };

  switch (room.kind) {
    case "chat": {
      const counter = chatCounter(room);
      solid(counter.centerX, back(counter.fromBack), counter.length + 0.3, counter.depth);
      for (let index = 0; index < counter.attendantCount; index++) chair(counter.left + counter.slot * (index + 0.5), 1.15);
      chatWaitingChairs(room).forEach(({ x, z }) => solid(x, z, 0.8, 0.7));
      break;
    }
    case "workspace":
    case "admin":
    case "finance": {
      const rows = room.kind === "workspace" ? [1.4, 5.2] : [1.6];
      rows.forEach((row) => roomColumns(room, 3).forEach((x) => workstation(x, row)));
      if (room.kind === "finance") solid(halfWidth - 1.5, back(ROOM_DEPTH - 3.2), 2.2, 1.4);
      if (room.kind === "admin" || room.kind === "finance") {
        roomColumns(room, 1.4, 1)
          .slice(0, 3)
          .forEach((x) => solid(x, back(ROOM_DEPTH - 1.6), 1.2, 0.72));
      }
      break;
    }
    case "sales":
    case "field": {
      roomColumns(room, 3.2).forEach((x) => {
        solid(x, back(4), 2.5, 0.85);
        chair(x, 2.8);
      });
      break;
    }
    case "agenda":
      solid(0, back(ROOM_DEPTH - 4.2), 5.1, 1.05);
      break;
    case "meeting": {
      const tableLength = Math.max(3, room.width - 5);
      solid(0, back(5.4), tableLength, 2.4);
      const chairs = Math.max(2, Math.floor(tableLength / 1.4));
      for (let index = 0; index < chairs; index++) {
        const x = -tableLength / 2 + 0.7 + index * ((tableLength - 1.4) / Math.max(1, chairs - 1));
        [3.6, 7.2].forEach((fromBack) => chair(x, fromBack));
      }
      break;
    }
    case "restroom": {
      solid(0, back((ROOM_DEPTH - 4) / 2), 0.25, ROOM_DEPTH - 4);
      [-1, 1].forEach((half) => {
        const centerX = (half * room.width) / 4;
        solid(centerX, back(1.2), room.width / 2 - 1, 1.6);
        solid(centerX, back(ROOM_DEPTH - 3), 1.4, 0.6);
      });
      break;
    }
    case "common": {
      const tables = room.width > 9 ? [-2.4, 2.4] : [0];
      tables.forEach((x) => {
        solid(x, back(6), 2, 2);
        ([[0, -1.6], [0, 1.6], [-1.6, 0], [1.6, 0]] as const).forEach(([offsetX, offsetFromBack]) => chair(x + offsetX, 6 + offsetFromBack));
      });
      solid(-room.width / 2 + 1.2, back(1), 1.2, 1);
      solid(room.width / 2 - 2.2, back(1.1), 2.4, 1.3);
      break;
    }
    case "terminal":
      solid(halfWidth - 1.4, back(1.3), 1.1, 1.1);
      break;
  }

  const plants: CornerPlant[] = [];
  [-1, 1].forEach((side) => {
    const x = side * (halfWidth - 0.9);
    const z = back(ROOM_DEPTH - 0.9);
    const isBlocked = obstacles.some((box) => Math.abs(room.cx + x - box.x) < box.halfWidth + 0.5 && Math.abs(room.cz + z - box.z) < box.halfDepth + 0.5);
    if (room.kind === "restroom" || isBlocked) return;
    if (chairSpots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < 1.2)) return;
    plants.push({ x, z, model: side < 0 ? "cactus_medium_A" : "cactus_medium_B" });
    solid(x, z, 0.9, 0.9);
  });
  return { obstacles, plants };
}

/** Todos os móveis fixos da estação. */
export function stationObstacles(rooms: readonly RoomLayout[]): Obstacle[] {
  return rooms.flatMap((room) => roomFurniture(room).obstacles);
}

/** Quantos leads da fila do NasaChat aparecem em pé na sala (spec 0121, RF-10). */
export const CHAT_QUEUE_SPOTS = 8;

/** Lugar `index` da fila do NasaChat: duas fileiras de 4 depois da porta, de frente para os guichês. Posição no mundo. */
export function chatQueueSpot(chat: RoomLayout, index: number): { x: number; z: number } {
  const inside = doorWaypoints(chat).inside;
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: chat.cx + (column - 1.5) * 1.3, z: inside.z - chat.towardDoor * (1.6 + row * 1.4) };
}
