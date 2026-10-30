import * as THREE from "three";
import { ROOM_KINDS } from "../layout/room-kinds";
import {
  DOOR_WIDTH,
  HALL_WIDTH,
  ROOM_DEPTH,
  ROOM_GAP_Z,
  WALL_HEIGHT,
  type Obstacle,
  type RoomLayout,
  type StationLayout,
} from "../layout/station-layout";
import { furnishRoom } from "./furnish-room";
import { drawFloorTexture, litMaterial, type StationMaterials } from "./materials";
import type { ModelLibrary } from "./model-library";
import { addBox, addCylinder, addTube } from "./primitives";

/** O que o motor anima em cada sala depois de montada. */
export interface RoomVisual {
  layout: RoomLayout;
  group: THREE.Group;
  floorMaterial: THREE.MeshStandardMaterial;
  doorPanels: THREE.Mesh[];
  screens: THREE.Mesh[];
  ring: THREE.Mesh | null;
  spinner: THREE.Mesh | null;
  doorOpen: number;
  enterGlow: number;
}

export interface BuiltStation {
  root: THREE.Group;
  rooms: RoomVisual[];
  obstacles: Obstacle[];
}

function buildHall(root: THREE.Group, layout: StationLayout, materials: StationMaterials) {
  const length = layout.hallLength + 2;
  const hallMaterial = materials.hall.clone();
  hallMaterial.map = materials.hall.map!.clone();
  hallMaterial.map.repeat.set(length / 6, 1);
  hallMaterial.userData.ownsMap = true;
  addBox(root, length, 0.4, HALL_WIDTH, hallMaterial, 0, 0.05, 0);
  addBox(root, length + 0.6, 1.3, HALL_WIDTH + 0.6, materials.hull, 0, -0.75, 0);
  addBox(root, length - 2, 0.7, HALL_WIDTH - 1.6, materials.hullDark, 0, -1.6, 0);
  [-1, 1].forEach((side) => {
    const edgeZ = side * (HALL_WIDTH / 2 + 0.05);
    const openings = layout.rooms
      .filter((room) => (room.side === "top" ? -1 : 1) === side)
      .map((room) => [room.cx - DOOR_WIDTH / 2 - 0.3, room.cx + DOOR_WIDTH / 2 + 0.3] as const)
      .sort((first, second) => first[0] - second[0]);
    let start = -length / 2;
    [...openings, [length / 2, length / 2] as const].forEach(([openFrom, openTo]) => {
      const segment = openFrom - start;
      if (segment > 0.3) {
        addBox(root, segment, 0.55, 0.3, materials.wallLow, start + segment / 2, 0.5, edgeZ);
        addTube(root, segment, 0.13, materials.rail, start + segment / 2, 0.85, edgeZ, true);
      }
      start = openTo;
    });
    addBox(root, length, 0.06, 0.12, materials.glow, 0, 0.27, side * (HALL_WIDTH / 2 - 0.12));
  });
  [-1, 1].forEach((end) => {
    addBox(root, 0.4, 0.9, HALL_WIDTH, materials.wall, end * (length / 2), 0.6, 0);
    addTube(root, HALL_WIDTH, 0.2, materials.rail, end * (length / 2), 1.1, 0, false);
  });
}

function buildRoom(root: THREE.Group, room: RoomLayout, materials: StationMaterials, library: ModelLibrary, obstacles: Obstacle[]): RoomVisual {
  const kind = ROOM_KINDS[room.kind];
  const group = new THREE.Group();
  group.position.set(room.cx, 0, room.cz);
  root.add(group);
  const rimMaterial = litMaterial({ color: new THREE.Color(kind.color) });

  const floorMap = drawFloorTexture(kind.floor);
  floorMap.repeat.set(room.width / 7, ROOM_DEPTH / 7);
  const floorTop = litMaterial({ color: 0xffffff, map: floorMap, roughness: 0.6, metalness: 0.05 });
  floorTop.userData.ownsMap = true;
  addBox(group, room.width, 0.5, ROOM_DEPTH, [materials.dark, materials.dark, floorTop, materials.dark, materials.dark, materials.dark], 0, 0, 0);

  const towardDoor = room.towardDoor;
  const halfWidth = room.width / 2;
  const halfDepth = ROOM_DEPTH / 2;

  // casco do módulo
  addBox(group, room.width + 0.7, 1.3, ROOM_DEPTH + 0.7, materials.hull, 0, -0.75, 0);
  addBox(group, room.width - 1.2, 0.8, ROOM_DEPTH - 1.2, materials.hullDark, 0, -1.7, 0);
  addBox(group, room.width + 0.8, 0.16, ROOM_DEPTH + 0.8, rimMaterial, 0, -0.32, 0);

  const walls = [
    { axis: "x", offset: -halfDepth, length: room.width, hasDoor: towardDoor === -1, inward: 1 },
    { axis: "x", offset: halfDepth, length: room.width, hasDoor: towardDoor === 1, inward: -1 },
    { axis: "z", offset: -halfWidth, length: ROOM_DEPTH, hasDoor: false, inward: 1 },
    { axis: "z", offset: halfWidth, length: ROOM_DEPTH, hasDoor: false, inward: -1 },
  ] as const;
  const rimY = 0.25 + WALL_HEIGHT + 0.12;
  walls.forEach((wall) => {
    const isSouth = wall.axis === "x" && wall.offset > 0;
    const material = isSouth ? materials.wallLow : materials.wall;
    const segments: [number, number][] = wall.hasDoor
      ? [[-wall.length / 2, -DOOR_WIDTH / 2], [DOOR_WIDTH / 2, wall.length / 2]]
      : [[-wall.length / 2, wall.length / 2]];
    segments.forEach(([from, to]) => {
      const length = to - from;
      const center = (from + to) / 2;
      if (wall.axis === "x") {
        addBox(group, length, WALL_HEIGHT, 0.4, material, center, 0.25 + WALL_HEIGHT / 2, wall.offset);
        addBox(group, length, 0.08, 0.42, materials.panelLine, center, 0.25 + WALL_HEIGHT * 0.55, wall.offset);
        addTube(group, length, 0.26, rimMaterial, center, rimY, wall.offset, true);
        addBox(group, length, 0.06, 0.08, materials.glow, center, 0.29, wall.offset + wall.inward * 0.24);
      } else {
        addBox(group, 0.4, WALL_HEIGHT, length, material, wall.offset, 0.25 + WALL_HEIGHT / 2, center);
        addBox(group, 0.42, 0.08, length, materials.panelLine, wall.offset, 0.25 + WALL_HEIGHT * 0.55, center);
        addTube(group, length, 0.26, rimMaterial, wall.offset, rimY, center, false);
        addBox(group, 0.08, 0.06, length, materials.glow, wall.offset + wall.inward * 0.24, 0.29, center);
      }
    });
  });
  [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [-halfWidth, halfDepth], [halfWidth, halfDepth]].forEach(([x, z]) => {
    addCylinder(group, 0.38, 0.38, WALL_HEIGHT + 0.3, rimMaterial, x, 0.25 + (WALL_HEIGHT + 0.3) / 2, z, 16);
  });

  const doorZ = towardDoor * halfDepth;
  const frameMaterial = litMaterial({ color: 0xb7bdd6 });
  [-1, 1].forEach((side) => addBox(group, 0.3, 2.3, 0.6, frameMaterial, side * (DOOR_WIDTH / 2 + 0.15), 1.4, doorZ));
  addBox(group, DOOR_WIDTH + 0.6, 0.3, 0.6, frameMaterial, 0, 2.55, doorZ);
  const doorPanels = [-1, 1].map((side) => {
    const panel = addBox(group, DOOR_WIDTH / 2, 1.9, 0.14, materials.doorPanel, (side * DOOR_WIDTH) / 4, 1.2, doorZ);
    panel.userData.closedX = (side * DOOR_WIDTH) / 4;
    panel.userData.side = side;
    return panel;
  });

  // ponte até o corredor
  const bridgeLength = ROOM_GAP_Z + 0.5;
  const bridgeZ = (room.doorWallZ + room.hallEdgeZ) / 2;
  addBox(root, DOOR_WIDTH + 0.6, 0.36, bridgeLength, materials.hall, room.cx, 0.04, bridgeZ);
  addBox(root, DOOR_WIDTH + 0.2, 0.9, bridgeLength - 0.2, materials.hullDark, room.cx, -0.6, bridgeZ);
  [-1, 1].forEach((side) => {
    addBox(root, 0.22, 0.5, bridgeLength, materials.wallLow, room.cx + side * (DOOR_WIDTH / 2 + 0.2), 0.45, bridgeZ);
    addTube(root, bridgeLength, 0.1, materials.rail, room.cx + side * (DOOR_WIDTH / 2 + 0.2), 0.75, bridgeZ, false);
  });
  [room.doorWallZ + towardDoor * 0.35, room.hallEdgeZ - towardDoor * 0.3].forEach((z) =>
    addBox(root, DOOR_WIDTH, 0.05, 0.4, materials.hazard, room.cx, 0.24, z),
  );

  const furnished = furnishRoom({ room, group, materials, library, obstacles });
  return { layout: room, group, floorMaterial: floorTop, doorPanels, screens: furnished.screens, ring: furnished.ring, spinner: furnished.spinner, doorOpen: 0, enterGlow: 0 };
}

export function buildStation(layout: StationLayout, materials: StationMaterials, library: ModelLibrary): BuiltStation {
  const root = new THREE.Group();
  const obstacles: Obstacle[] = [];
  buildHall(root, layout, materials);
  const rooms = layout.rooms.map((room) => buildRoom(root, room, materials, library, obstacles));
  return { root, rooms, obstacles };
}
