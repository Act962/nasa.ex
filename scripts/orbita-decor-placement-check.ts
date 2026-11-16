// Regra de posição da decoração da Órbita Station (spec 0118, CA-6, CA-13, CB-11, CB-12).
// Rodar da raiz do repositório: pnpm exec tsx scripts/orbita-decor-placement-check.ts
import { createPlacementContext, validatePlacement } from "../src/features/orbita-station/layout/decor-placement";
import { DECOR_CATALOG } from "../src/features/orbita-station/layout/decor-catalog";
import { chatQueueSpot } from "../src/features/orbita-station/layout/room-furniture";
import { resolveLayout, ROOM_DEPTH } from "../src/features/orbita-station/layout/station-layout";
import { existsSync } from "node:fs";

const layout = resolveLayout("completo");
const room = (kind: string) => layout.rooms.find((candidate) => candidate.kind === kind)!;
const common = room("common");
const workspace = room("workspace");
const finance = room("finance");
const chat = room("chat");
const allOpen = () => true;
const placed = [{ id: "a", itemKey: "couch", x: common.cx, z: common.cz - common.towardDoor * 0 + 2, quarterTurns: 0 }];
const context = createPlacementContext(layout, placed, allOpen);
const lockedContext = createPlacementContext(layout, [], (candidate) => candidate.kind !== "finance");
let failures = 0;
const check = (label: string, expected: string, result: ReturnType<typeof validatePlacement>) => {
  const got = result.ok ? "ok" : result.problem;
  if (got !== expected) failures++;
  console.log(got === expected ? "PASSOU" : "FALHOU", label, "→", got, got === expected ? "" : `(esperado ${expected})`);
};
const deepInside = (target: typeof common, fromBack: number) => target.cz - target.towardDoor * (ROOM_DEPTH / 2 - fromBack);

check("poltrona livre na copa, perto da parede do fundo", "ok", validatePlacement(context, { itemKey: "armchair", x: common.cx + 3.5, z: deepInside(common, 3), quarterTurns: 0 }));
check("em cima do sofá já colocado", "OVERLAPS_ITEM", validatePlacement(context, { itemKey: "armchair", x: common.cx, z: common.cz + 2, quarterTurns: 0 }));
check("mover o próprio sofá para o mesmo lugar", "ok", validatePlacement(context, { itemKey: "couch", x: common.cx, z: common.cz + 2, quarterTurns: 0, ignoreId: "a" }));
check("meio do corredor", "BLOCKS_PASSAGE", validatePlacement(context, { itemKey: "armchair", x: 0, z: 0.5, quarterTurns: 0 }));
check("lateral do corredor", "ok", validatePlacement(context, { itemKey: "cactus_small_A", x: workspace.cx + 4, z: -2.3, quarterTurns: 0 }));
check("na porta do workspace", "BLOCKS_PASSAGE", validatePlacement(context, { itemKey: "armchair", x: workspace.cx, z: workspace.doorWallZ - workspace.towardDoor * 1, quarterTurns: 0 }));
check("em cima de uma mesa do workspace", "BLOCKED_AREA", validatePlacement(context, { itemKey: "armchair", x: workspace.cx, z: deepInside(workspace, 1.4), quarterTurns: 0 }));
check("fila do chat", "BLOCKED_AREA", validatePlacement(context, { itemKey: "armchair", ...chatQueueSpot(chat, 1), quarterTurns: 0 }));
check("fora da estação", "OUT_OF_BOUNDS", validatePlacement(context, { itemKey: "armchair", x: 0, z: 40, quarterTurns: 0 }));
check("atravessando a parede da sala", "OUT_OF_BOUNDS", validatePlacement(context, { itemKey: "couch", x: common.cx + common.width / 2, z: common.cz, quarterTurns: 0 }));
check("sala trancada", "ROOM_LOCKED", validatePlacement(lockedContext, { itemKey: "armchair", x: finance.cx + 2, z: deepInside(finance, 6), quarterTurns: 0 }));
check("giro inválido", "INVALID_TRANSFORM", validatePlacement(context, { itemKey: "armchair", x: common.cx, z: common.cz, quarterTurns: 5 }));
check("item desconhecido", "UNKNOWN_ITEM", validatePlacement(context, { itemKey: "nave", x: common.cx, z: common.cz, quarterTurns: 0 }));
check("tapete por cima do sofá", "ok", validatePlacement(context, { itemKey: "rug_oval_A", x: common.cx, z: common.cz + 2, quarterTurns: 1 }));
// CA-13: todo item do catálogo tem o arquivo.
const missing = DECOR_CATALOG.filter((item) => !existsSync(`public/orbita-station/models/furniture/${item.file}`));
console.log(missing.length ? `FALHOU modelos faltando: ${missing.map((item) => item.file).join(", ")}` : `PASSOU todos os ${DECOR_CATALOG.length} itens têm .glb`);
if (missing.length) failures++;
if (failures) process.exit(1);
