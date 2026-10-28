import * as THREE from "three";
import { ROOM_KINDS } from "../layout/room-kinds";
import { FLOOR_TOP, ROOM_DEPTH, type Obstacle, type RoomLayout } from "../layout/station-layout";
import { glowMaterial, litMaterial, type StationMaterials } from "./materials";
import type { FurnitureName, ModelLibrary } from "./model-library";
import { addBox, addCylinder } from "./primitives";

// Os assentos do KayKit ficam a 0,5 do piso; em 0,5 batem com as pernas curtas dos personagens.
const FURNITURE_SCALE = 0.5;
// Cadeiras na largura dos ombros, mas com o assento baixo das pernas curtas do KayKit (0,30 do piso).
const CHAIR_SCALE: [number, number, number] = [1.1, 0.6, 1.1];
const SPACE_CHAIR_SCALE: [number, number, number] = [1.7, 1.2, 1.7]; // cadeiras do Kenney: 0,5 de largura e assento a 0,25

interface FurnishInput {
  room: RoomLayout;
  group: THREE.Group;
  materials: StationMaterials;
  library: ModelLibrary;
  obstacles: Obstacle[];
}

interface FurnishResult {
  screens: THREE.Mesh[];
  ring: THREE.Mesh | null;
  spinner: THREE.Mesh | null;
}

type ChairTag = "desk" | "meeting" | "common" | "counter";

export function furnishRoom({ room, group, materials, library, obstacles }: FurnishInput): FurnishResult {
  const towardDoor = room.towardDoor;
  const halfWidth = room.width / 2;
  /** z local a partir da parede do fundo (oposta à porta). */
  const fromBackZ = (fromBack: number) => (-towardDoor * ROOM_DEPTH) / 2 + towardDoor * fromBack;
  const faceDoor = towardDoor > 0 ? 0 : Math.PI;
  const faceBack = towardDoor > 0 ? Math.PI : 0;
  const kindColor = ROOM_KINDS[room.kind].color;
  const accent = litMaterial({ color: kindColor, emissive: new THREE.Color(kindColor), emissiveIntensity: 0.35 });
  const result: FurnishResult = { screens: [], ring: null, spinner: null };
  const chairSpots: { x: number; z: number; tag: ChairTag }[] = [];

  const addFurniture = (name: FurnitureName, x: number, z: number, rotationY = 0, scale: number | [number, number, number] = FURNITURE_SCALE) => {
    const model = library.cloneFurniture(name);
    if (!model) return null;
    if (Array.isArray(scale)) model.scale.set(...scale);
    else model.scale.setScalar(scale);
    model.position.set(x, FLOOR_TOP, z);
    model.rotation.y = rotationY;
    group.add(model);
    return model;
  };
  const solid = (x: number, z: number, width: number, depth: number) =>
    obstacles.push({ x: room.cx + x, z: room.cz + z, halfWidth: width / 2, halfDepth: depth / 2 });
  // Postos de trabalho e reunião com as cadeiras da estação (Kenney); a copa mantém as de madeira.
  const chairAt = (x: number, fromBack: number, rotation: number, tag: ChairTag) => {
    if (tag === "common") addFurniture("chair_A_wood", x, fromBackZ(fromBack), rotation, CHAIR_SCALE);
    else addFurniture(tag === "meeting" ? "kenney:chair-armrest" : "kenney:chair-armrest-headrest", x, fromBackZ(fromBack), rotation, SPACE_CHAIR_SCALE);
    chairSpots.push({ x, z: fromBackZ(fromBack), tag });
  };
  const workstation = (x: number, fromBack: number) => {
    addFurniture("kenney:table", x, fromBackZ(fromBack), faceDoor, [1.82, 1.9, 1.67]);
    addBox(group, 0.36, 0.03, 0.24, materials.metal, x, 1.03, fromBackZ(fromBack - 0.25));
    addBox(group, 0.07, 0.22, 0.07, materials.metal, x, 1.14, fromBackZ(fromBack - 0.25));
    result.screens.push(addBox(group, 0.9, 0.55, 0.08, materials.screen, x, 1.5, fromBackZ(fromBack - 0.25), faceDoor));
    solid(x, fromBackZ(fromBack), 2, 1);
    chairAt(x, fromBack + 1, faceBack, "desk");
  };
  const across = (spacing: number, margin = 1.6) => {
    const count = Math.max(1, Math.floor((room.width - margin * 2) / spacing) + 1);
    const span = (count - 1) * spacing;
    return Array.from({ length: count }, (_, index) => -span / 2 + index * spacing);
  };

  switch (room.kind) {
    case "chat": {
      // Balcão contínuo encostado no fundo, com passagem na ponta direita; sala de espera na frente.
      const counterFromBack = 2.4;
      const counterDepth = 1;
      const passage = 2.2;
      const left = -halfWidth + 0.45;
      const right = halfWidth - 0.45 - passage;
      const counterLength = right - left;
      const counterCenterX = (left + right) / 2;
      const counterZ = fromBackZ(counterFromBack);
      const counterTop = litMaterial({ color: 0xe9e7f2 });
      const counterBody = litMaterial({ color: 0x3a3f63 });
      // Altura de mesa (não de balcão de bar): o atendente sentado alcança o notebook.
      addBox(group, counterLength, 0.6, counterDepth, counterBody, counterCenterX, 0.55, counterZ);
      addBox(group, counterLength + 0.1, 0.1, counterDepth + 0.15, counterTop, counterCenterX, 0.88, counterZ);
      addBox(group, counterLength, 0.06, 0.06, materials.glow, counterCenterX, 0.32, counterZ + towardDoor * (counterDepth / 2 + 0.02));
      addBox(group, 0.25, 0.75, counterDepth, counterBody, right + 0.1, 0.62, counterZ);
      solid(counterCenterX, counterZ, counterLength + 0.3, counterDepth);
      addBox(group, 2.4, 1.2, 0.12, materials.screen, halfWidth - 1.6, 1.6, fromBackZ(0.35));

      const attendantCount = Math.max(2, Math.round(counterLength / 3));
      const slot = counterLength / attendantCount;
      const glass = litMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 });
      const glassEdge = glowMaterial({ color: new THREE.Color(0x3de0f0).multiplyScalar(2.2) });
      const laptopBody = litMaterial({ color: 0x8a91ad });
      const laptopScreen = litMaterial({ color: 0x10303a, emissive: 0x3de0f0, emissiveIntensity: 1.8, roughness: 0.2 });
      for (let index = 0; index < attendantCount; index++) {
        const x = left + slot * (index + 0.5);
        addBox(group, 0.8, 0.04, 0.5, laptopBody, x, 0.95, counterZ - towardDoor * 0.12);
        const screen = addBox(group, 0.8, 0.5, 0.04, laptopScreen, x, 1.19, counterZ - towardDoor * 0.05, faceBack);
        screen.rotation.x = -0.25 * towardDoor;
        addBox(group, 0.5, 0.03, 0.18, materials.dark, x, 0.95, counterZ - towardDoor * 0.38);
        chairAt(x, 1.15, faceDoor, "counter");
        // vidro da frente com janela de atendimento no meio
        const paneWidth = (slot - 0.9) / 2;
        [-1, 1].forEach((side) => {
          addBox(group, paneWidth, 0.75, 0.04, glass, x + side * (0.45 + paneWidth / 2), 1.32, counterZ + towardDoor * (counterDepth / 2 - 0.05));
          addBox(group, paneWidth, 0.03, 0.06, glassEdge, x + side * (0.45 + paneWidth / 2), 1.7, counterZ + towardDoor * (counterDepth / 2 - 0.05));
        });
      }
      for (let divider = 0; divider <= attendantCount; divider++) {
        const x = left + slot * divider;
        addBox(group, 0.05, 0.85, counterDepth + 0.1, glass, x, 1.36, counterZ);
        addBox(group, 0.07, 0.03, counterDepth + 0.1, glassEdge, x, 1.79, counterZ);
      }
      [5.3, 6.9, 8.5].forEach((fromBack) => {
        for (let x = -halfWidth + 1.2; x <= halfWidth - 1.6; x += 1.35) {
          if (Math.abs(x) < 1.5) continue;
          addFurniture("kenney:chair-armrest", x, fromBackZ(fromBack), faceBack, SPACE_CHAIR_SCALE);
          solid(x, fromBackZ(fromBack), 0.8, 0.7);
        }
      });
      break;
    }
    case "workspace":
    case "admin":
    case "finance": {
      const rows = room.kind === "workspace" ? [1.4, 5.2] : [1.6];
      rows.forEach((row) => across(3).forEach((x) => workstation(x, row)));
      if (room.kind === "finance") {
        addBox(group, 2.2, 2.2, 1.4, materials.metal, halfWidth - 1.5, 1.35, fromBackZ(ROOM_DEPTH - 3.2));
        solid(halfWidth - 1.5, fromBackZ(ROOM_DEPTH - 3.2), 2.2, 1.4);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 8, 20), litMaterial({ color: 0xf2c230 }));
        wheel.position.set(halfWidth - 1.5, 1.4, fromBackZ(ROOM_DEPTH - 3.2) + towardDoor * 0.72);
        group.add(wheel);
        result.spinner = wheel;
      }
      if (room.kind === "admin" || room.kind === "finance") {
        across(1.4, 1)
          .slice(0, 3)
          .forEach((x, index) => {
            addFurniture(index % 2 ? "kenney:container-wide" : "kenney:container-tall", x, fromBackZ(ROOM_DEPTH - 1.6), faceBack, [2, 2, 1.2]);
            solid(x, fromBackZ(ROOM_DEPTH - 1.6), 1.2, 0.72);
          });
      }
      if (room.kind === "workspace") {
        addBox(group, 3, 1.6, 0.15, materials.white, 0, 1.4, fromBackZ(0.3));
        ["#3de0f0", "#ffc93c", "#ff8a3d", "#43d17a"].forEach((color, index) =>
          addBox(group, 0.6, 0.35, 0.06, litMaterial({ color: new THREE.Color(color) }), -1 + index * 0.66, 1.6, fromBackZ(0.4)),
        );
      }
      break;
    }
    case "sales":
    case "field": {
      across(3.2).forEach((x) => {
        addFurniture("kenney:table-large", x, fromBackZ(4), faceBack, [1.79, 1.8, 0.94]);
        addBox(group, 2.5, 0.06, 0.04, accent, x, 0.94, fromBackZ(4) + towardDoor * 0.44);
        result.screens.push(addBox(group, 0.8, 0.5, 0.08, materials.screen, x - 0.5, 1.26, fromBackZ(3.85), faceBack));
        addFurniture("chair_stool", x, fromBackZ(5.4), 0, CHAIR_SCALE);
        solid(x, fromBackZ(4), 2.5, 0.85);
        chairAt(x, 2.8, faceDoor, "desk");
      });
      if (room.kind === "field") addBox(group, Math.min(5, room.width - 3), 2, 0.15, litMaterial({ color: 0xd9f0d4 }), 0, 1.5, fromBackZ(0.3));
      break;
    }
    case "agenda": {
      addBox(group, 5, 1.05, 0.9, materials.woodLight, 0, 0.78, fromBackZ(ROOM_DEPTH - 4.2));
      addBox(group, 5.1, 0.12, 1.05, accent, 0, 1.32, fromBackZ(ROOM_DEPTH - 4.2));
      solid(0, fromBackZ(ROOM_DEPTH - 4.2), 5.1, 1.05);
      addBox(group, 4.4, 2.4, 0.15, materials.white, 0, 1.6, fromBackZ(0.3));
      const slotMaterial = litMaterial({ color: 0xd9d3ee });
      for (let column = 0; column < 4; column++)
        for (let row = 0; row < 3; row++)
          addBox(group, 0.9, 0.55, 0.06, (column + row) % 3 ? slotMaterial : accent, -1.55 + column * 1.03, 0.95 + row * 0.7, fromBackZ(0.4));
      break;
    }
    case "meeting": {
      const tableLength = Math.max(3, room.width - 5);
      addFurniture("table_medium_long", 0, fromBackZ(5.4), 0, [tableLength / 3, 0.69, 1.2]);
      solid(0, fromBackZ(5.4), tableLength, 2.4);
      addBox(group, Math.min(4, room.width - 3), 2, 0.12, materials.screen, 0, 1.7, fromBackZ(0.3));
      const chairs = Math.max(2, Math.floor(tableLength / 1.4));
      for (let index = 0; index < chairs; index++) {
        const x = -tableLength / 2 + 0.7 + index * ((tableLength - 1.4) / Math.max(1, chairs - 1));
        [3.6, 7.2].forEach((fromBack) => chairAt(x, fromBack, fromBack < 5.4 ? faceDoor : faceBack, "meeting"));
      }
      break;
    }
    case "restroom": {
      addBox(group, 0.25, 1.6, ROOM_DEPTH - 4, materials.wall, 0, 1.05, fromBackZ((ROOM_DEPTH - 4) / 2));
      solid(0, fromBackZ((ROOM_DEPTH - 4) / 2), 0.25, ROOM_DEPTH - 4);
      const stallMaterial = litMaterial({ color: 0x9fb5c9 });
      [-1, 1].forEach((half) => {
        const centerX = (half * room.width) / 4;
        addBox(group, room.width / 2 - 1, 1.6, 1.6, stallMaterial, centerX, 1.05, fromBackZ(1.2));
        solid(centerX, fromBackZ(1.2), room.width / 2 - 1, 1.6);
        addBox(group, 1.4, 0.8, 0.6, materials.white, centerX, 0.65, fromBackZ(ROOM_DEPTH - 3));
        solid(centerX, fromBackZ(ROOM_DEPTH - 3), 1.4, 0.6);
      });
      break;
    }
    case "common": {
      const tables = room.width > 9 ? [-2.4, 2.4] : [0];
      tables.forEach((x) => {
        addCylinder(group, 1.1, 1.1, 0.12, materials.white, x, 0.88, fromBackZ(6), 24);
        addCylinder(group, 0.15, 0.3, 0.6, materials.dark, x, 0.55, fromBackZ(6));
        solid(x, fromBackZ(6), 2, 2);
        ([[0, -1.6, faceDoor], [0, 1.6, faceBack], [-1.6, 0, Math.PI / 2], [1.6, 0, -Math.PI / 2]] as const).forEach(([offsetX, offsetFromBack, rotation]) =>
          chairAt(x + offsetX, 6 + offsetFromBack, rotation, "common"),
        );
      });
      addFurniture("kenney:container-tall", -room.width / 2 + 1.2, fromBackZ(1), faceDoor, [2, 2.67, 1.67]);
      solid(-room.width / 2 + 1.2, fromBackZ(1), 1.2, 1);
      addFurniture("couch_pillows", room.width / 2 - 2.2, fromBackZ(1.1), faceDoor, 0.8);
      solid(room.width / 2 - 2.2, fromBackZ(1.1), 2.4, 1.3);
      break;
    }
    case "terminal": {
      addCylinder(group, 1.6, 1.7, 0.16, litMaterial({ color: 0x3de0f0, emissive: 0x3de0f0, emissiveIntensity: 0.5 }), 0, 0.33, fromBackZ(3.4), 28);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.08, 6, 40), glowMaterial({ color: 0x9ff3ff }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.45, fromBackZ(3.4));
      group.add(ring);
      result.ring = ring;
      across(1.4, 1.2)
        .slice(0, 4)
        .forEach((x) => addFurniture("kenney:chair-armrest-headrest", x, fromBackZ(ROOM_DEPTH - 2), faceBack, SPACE_CHAIR_SCALE));
      addFurniture("kenney:table-display-planet", halfWidth - 1.1, fromBackZ(1.3), faceDoor, 2.2);
      solid(halfWidth - 1.4, fromBackZ(1.3), 1.1, 1.1);
      break;
    }
  }

  // Cabos de energia no piso ligando os postos (assinatura visual da estação)
  const desks = chairSpots.filter((spot) => spot.tag === "desk");
  if (desks.length >= 2) {
    const cableZ = fromBackZ(0.55);
    const deskXs = desks.map((spot) => spot.x);
    const minX = Math.min(...deskXs);
    const maxX = Math.max(...deskXs);
    const cable = litMaterial({ color: 0x3de0f0, emissive: 0x3de0f0, emissiveIntensity: 0.5 });
    addBox(group, maxX - minX + 0.12, 0.04, 0.12, cable, (minX + maxX) / 2, 0.27, cableZ);
    addCylinder(group, 0.32, 0.36, 0.14, materials.metal, minX - 0.6, 0.3, cableZ, 14);
    addCylinder(group, 0.16, 0.16, 0.16, cable, minX - 0.6, 0.36, cableZ, 12);
    addBox(group, 0.6, 0.04, 0.12, cable, minX - 0.3, 0.27, cableZ);
  }
  // Plantas nos cantos do fundo e tapete nas salas de convivência
  [-1, 1].forEach((side) => {
    const x = side * (halfWidth - 0.9);
    const z = fromBackZ(ROOM_DEPTH - 0.9);
    const isBlocked = obstacles.some((box) => Math.abs(room.cx + x - box.x) < box.halfWidth + 0.5 && Math.abs(room.cz + z - box.z) < box.halfDepth + 0.5);
    if (room.kind === "restroom" || isBlocked) return;
    if (chairSpots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < 1.2)) return;
    addFurniture(side < 0 ? "cactus_medium_A" : "cactus_medium_B", x, z, 0, 1.2);
    solid(x, z, 0.9, 0.9);
  });
  if (room.kind === "common" || room.kind === "meeting" || room.kind === "agenda") {
    const rugColor = new THREE.Color(kindColor).lerp(new THREE.Color(0xffffff), 0.45);
    addBox(group, Math.min(room.width - 3, 7), 0.03, 4.2, litMaterial({ color: rugColor }), 0, 0.265, fromBackZ(room.kind === "agenda" ? ROOM_DEPTH - 3 : 5.6));
  }
  return result;
}
