// Decoração da estação no motor (spec 0118): desenha os itens colocados, dá a eles colisão e cuida da prévia que
// segue o cursor no modo Decorar. A regra de onde pode ficar é a mesma do servidor (`layout/decor-placement.ts`).
import * as THREE from "three";
import { findDecorItem, type DecorItem } from "../layout/decor-catalog";
import {
  createPlacementContext,
  decorHalfExtents,
  decorObstacle,
  validatePlacement,
  type PlacedDecor,
  type PlacementContext,
  type PlacementProblem,
} from "../layout/decor-placement";
import { FLOOR_TOP, type Obstacle, type RoomOpenCheck, type StationLayout } from "../layout/station-layout";
import type { ModelLibrary } from "./model-library";
import { disposeObject } from "./primitives";

const VALID_COLOR = 0x43d17a;
const INVALID_COLOR = 0xff4f6d;
/** O item anda em passos de 25 cm: alinhar é mais fácil e a posição salva fica limpa. */
const SNAP = 0.25;
/** O contorno passa um pouco da pegada: do tamanho exato, ele some embaixo do próprio item. */
const OUTLINE_MARGIN = 0.35;

export interface DecorPlacementState {
  itemKey: string;
  movingId: string | null;
  x: number;
  z: number;
  quarterTurns: number;
  problem: PlacementProblem | null;
}

interface Preview {
  item: DecorItem;
  movingId: string | null;
  quarterTurns: number;
  x: number;
  z: number;
  model: THREE.Object3D | null;
  outline: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  fill: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  problem: PlacementProblem | null;
}

/** Posiciona o modelo: o centro da pegada fica em (x, z), descontando o pivô deslocado de alguns modelos. */
function placeModel(model: THREE.Object3D, item: DecorItem, x: number, z: number, quarterTurns: number) {
  const angle = (quarterTurns * Math.PI) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  model.scale.setScalar(item.scale);
  model.rotation.y = angle;
  model.position.set(x - (item.offsetX * cos + item.offsetZ * sin), FLOOR_TOP, z - (-item.offsetX * sin + item.offsetZ * cos));
}

export class DecorLayer {
  readonly group = new THREE.Group();
  /** Retângulos dos itens desenhados, somados aos móveis fixos na colisão e no "Ir até". */
  obstacles: Obstacle[] = [];
  /** Itens fora do piso depois de trocar o modelo de estação (RF-15): não são desenhados. */
  hiddenIds = new Set<string>();
  private placed: PlacedDecor[] = [];
  private readonly objects = new Map<string, THREE.Object3D>();
  private context: PlacementContext | null = null;
  private preview: Preview | null = null;
  private renderToken = 0;

  constructor(
    scene: THREE.Scene,
    private readonly library: ModelLibrary,
    private readonly prepare: (root: THREE.Object3D) => void,
    private readonly sharedMaterials: ReadonlySet<THREE.Material>,
    /** Avisa quais itens ficaram fora da estação a cada montagem (RF-15). */
    private readonly onRebuilt: (hiddenIds: ReadonlySet<string>) => void,
  ) {
    scene.add(this.group);
  }

  setStation(layout: StationLayout, isRoomOpen: RoomOpenCheck) {
    this.context = createPlacementContext(layout, this.placed, isRoomOpen);
    this.rebuild();
  }

  /** Lista que veio do servidor. Os modelos que faltam são baixados antes de desenhar. */
  async setItems(items: readonly PlacedDecor[]) {
    this.placed = [...items];
    if (this.context) this.context = { ...this.context, placed: this.placed };
    const token = ++this.renderToken;
    await this.library.loadDecor(this.uniqueItems(items));
    // Chegou uma lista mais nova enquanto baixava: ela é que vale.
    if (token !== this.renderToken) return;
    this.rebuild();
  }

  get placedItems(): readonly PlacedDecor[] {
    return this.placed;
  }

  async startPlacement(itemKey: string, movingId: string | null, at: { x: number; z: number }) {
    const item = findDecorItem(itemKey);
    if (!item) return;
    this.cancelPlacement();
    await this.library.loadDecor([item]);
    const moving = movingId ? this.placed.find((placed) => placed.id === movingId) : null;
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, 0.5),
    ]);
    const outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({ color: VALID_COLOR, toneMapped: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: VALID_COLOR, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
    fill.rotation.x = -Math.PI / 2;
    const model = this.library.cloneDecor(item.key);
    if (model) {
      this.prepare(model);
      this.group.add(model);
    }
    this.group.add(outline, fill);
    this.preview = { item, movingId, quarterTurns: moving?.quarterTurns ?? 0, x: moving?.x ?? at.x, z: moving?.z ?? at.z, model, outline, fill, problem: null };
    // Movendo: o original some enquanto a prévia está na mão.
    if (movingId) this.objects.get(movingId)?.removeFromParent();
    this.refreshPreview();
  }

  hasPreview(): boolean {
    return this.preview !== null;
  }

  movePreview(x: number, z: number): DecorPlacementState | null {
    if (!this.preview) return null;
    this.preview.x = Math.round(x / SNAP) * SNAP;
    this.preview.z = Math.round(z / SNAP) * SNAP;
    return this.refreshPreview();
  }

  rotatePreview(): DecorPlacementState | null {
    if (!this.preview) return null;
    this.preview.quarterTurns = (this.preview.quarterTurns + 1) % 4;
    return this.refreshPreview();
  }

  previewState(): DecorPlacementState | null {
    const preview = this.preview;
    if (!preview) return null;
    return { itemKey: preview.item.key, movingId: preview.movingId, x: preview.x, z: preview.z, quarterTurns: preview.quarterTurns, problem: preview.problem };
  }

  cancelPlacement() {
    const preview = this.preview;
    if (!preview) return;
    this.preview = null;
    if (preview.model) disposeObject(preview.model, this.sharedMaterials);
    [preview.outline, preview.fill].forEach((object) => {
      object.geometry.dispose();
      object.material.dispose();
      object.removeFromParent();
    });
    // Desistiu de mover: o original volta.
    if (preview.movingId) {
      const original = this.objects.get(preview.movingId);
      if (original) this.group.add(original);
    }
  }

  /** Item sob o cursor, para "Mover" e "Tirar" no modo Decorar. */
  pick(raycaster: THREE.Raycaster): string | null {
    let found: string | null = null;
    let nearest = Infinity;
    this.objects.forEach((object, id) => {
      if (!object.parent) return;
      const hit = raycaster.intersectObject(object, true)[0];
      if (hit && hit.distance < nearest) {
        nearest = hit.distance;
        found = id;
      }
    });
    return found;
  }

  dispose() {
    this.cancelPlacement();
    this.objects.forEach((object) => disposeObject(object, this.sharedMaterials));
    this.objects.clear();
    this.group.removeFromParent();
  }

  private uniqueItems(items: readonly PlacedDecor[]): DecorItem[] {
    const keys = new Set(items.map((item) => item.itemKey));
    return [...keys].flatMap((key) => {
      const item = findDecorItem(key);
      return item ? [item] : [];
    });
  }

  private rebuild() {
    const context = this.context;
    if (!context) return;
    this.objects.forEach((object) => disposeObject(object, this.sharedMaterials));
    this.objects.clear();
    this.hiddenIds = new Set();
    const obstacles: Obstacle[] = [];
    this.placed.forEach((placed) => {
      const item = findDecorItem(placed.itemKey);
      const result = validatePlacement(context, { itemKey: placed.itemKey, x: placed.x, z: placed.z, quarterTurns: placed.quarterTurns, ignoreId: placed.id });
      // Fora do piso ou numa sala trancada para quem olha: não desenha. Sobreposição com outro item não esconde.
      if (!result.ok && result.problem !== "OVERLAPS_ITEM") {
        this.hiddenIds.add(placed.id);
        return;
      }
      const model = (item && this.library.cloneDecor(item.key)) ?? this.unavailableBox(placed);
      if (item) placeModel(model, item, placed.x, placed.z, placed.quarterTurns);
      this.prepare(model);
      if (this.preview?.movingId !== placed.id) this.group.add(model);
      this.objects.set(placed.id, model);
      const obstacle = decorObstacle(placed);
      if (obstacle) obstacles.push(obstacle);
    });
    this.obstacles = obstacles;
    if (this.preview) this.refreshPreview();
    this.onRebuilt(this.hiddenIds);
  }

  /** Item cuja chave saiu do catálogo ou cujo modelo não baixou (CB-5): uma caixa no lugar, sem quebrar a estação. */
  private unavailableBox(placed: PlacedDecor): THREE.Object3D {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a91ad }));
    box.position.set(placed.x, FLOOR_TOP + 0.4, placed.z);
    return box;
  }

  private refreshPreview(): DecorPlacementState | null {
    const preview = this.preview;
    const context = this.context;
    if (!preview || !context) return null;
    const result = validatePlacement(context, {
      itemKey: preview.item.key,
      x: preview.x,
      z: preview.z,
      quarterTurns: preview.quarterTurns,
      ignoreId: preview.movingId ?? undefined,
    });
    preview.problem = result.ok ? null : result.problem;
    const color = result.ok ? VALID_COLOR : INVALID_COLOR;
    const { halfWidth, halfDepth } = decorHalfExtents(preview.item, preview.quarterTurns);
    preview.outline.material.color.set(color);
    preview.fill.material.color.set(color);
    preview.outline.scale.set(halfWidth * 2 + OUTLINE_MARGIN, 1, halfDepth * 2 + OUTLINE_MARGIN);
    preview.outline.position.set(preview.x, FLOOR_TOP + 0.03, preview.z);
    preview.fill.scale.set(halfWidth * 2 + OUTLINE_MARGIN, halfDepth * 2 + OUTLINE_MARGIN, 1);
    preview.fill.position.set(preview.x, FLOOR_TOP + 0.02, preview.z);
    if (preview.model) placeModel(preview.model, preview.item, preview.x, preview.z, preview.quarterTurns);
    return this.previewState();
  }
}
