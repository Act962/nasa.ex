// Motor da Órbita Station: Three.js puro, sem React. A interface conversa com ele pelos métodos públicos e
// pelos eventos de `onEvent` (spec 0117, D-2). Tudo que ele cria é liberado em `dispose` (RNF-4).
import * as THREE from "three";
import type { AvatarLook } from "../lib/avatar-look";
import {
  DOOR_WIDTH,
  PLAYER_RADIUS,
  ROOM_DEPTH,
  hitsObstacle,
  isWalkable,
  ROOM_OFFSET_Z,
  moveWithCollision,
  planRouteToRoom,
  resolveLayout,
  roomAt,
  spawnPoint,
  type RoomLayout,
  type StationLayout,
} from "../layout/station-layout";
import { ROOM_KINDS } from "../layout/room-kinds";
import { buildStation, type BuiltStation } from "./build-structure";
import { CharacterFactory, type CharacterRig } from "./character";
import { FinishPipeline, createEnvironmentTarget, type QualityTier } from "./finish";
import { DEFAULT_ENV_INTENSITY, createStationMaterials, type StationMaterials } from "./materials";
import { ModelLibrary } from "./model-library";
import { disposeObject } from "./primitives";
import { StudioPreview } from "./studio-preview";

export type StationEngineEvent =
  | { type: "ready" }
  | { type: "roomChange"; room: RoomLayout | null }
  | { type: "qualityChange"; tier: QualityTier }
  | { type: "error"; message: string };

export interface StationEngineOptions {
  templateKey: string;
  roomNames: Readonly<Record<string, string>>;
  look: AvatarLook;
  onEvent: (event: StationEngineEvent) => void;
}

export type StationMode = "play" | "map";

/** Etiqueta de sala para a interface desenhar por cima do canvas, em pixels CSS. */
export interface RoomLabel {
  key: string;
  name: string;
  module: string;
  color: string;
  x: number;
  y: number;
}

export class WebGLUnavailableError extends Error {
  constructor() {
    super("WebGL indisponível neste navegador");
  }
}

const CAMERA_OFFSET = new THREE.Vector3(12, 60, 44);
const WALK_SPEED = 7.5;
const MOVE_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1],
  s: [0, -1], arrowdown: [0, -1],
  d: [1, 0], arrowright: [1, 0],
  a: [-1, 0], arrowleft: [-1, 0],
};
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.2;

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest("input, select, textarea") !== null);

function drawSky(canvas: HTMLCanvasElement, width: number, height: number) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#120a2e";
  context.fillRect(0, 0, width, height);
  ([
    [0.15, 0.35, 0.55, 0.45, "rgba(75,29,143,0.75)"],
    [0.85, 0.75, 0.5, 0.45, "rgba(27,63,143,0.7)"],
    [0.7, 0.1, 0.35, 0.3, "rgba(212,61,240,0.2)"],
  ] as const).forEach(([centerX, centerY, radiusX, radiusY, color]) => {
    context.save();
    context.translate(centerX * width, centerY * height);
    context.scale(radiusX * width, radiusY * height);
    const nebula = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    nebula.addColorStop(0, color);
    nebula.addColorStop(0.7, "rgba(0,0,0,0)");
    context.fillStyle = nebula;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  });
  for (let i = 0; i < 240; i++) {
    context.fillStyle = Math.random() < 0.2 ? "#9ff3ff" : Math.random() < 0.2 ? "#f3a6ff" : "#ffffff";
    context.globalAlpha = 0.3 + Math.random() * 0.6;
    const size = Math.random() < 0.08 ? 2.2 : 1;
    context.fillRect(Math.random() * width, Math.random() * height, size, size);
  }
  context.globalAlpha = 1;
}

interface Player {
  rig: CharacterRig;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  facing: number;
  isWalking: boolean;
  /** Pontos que o personagem ainda vai percorrer sozinho (clique no mapa). */
  route: THREE.Vector3[];
}

export class StationEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  private readonly finish: FinishPipeline;
  private readonly environmentTarget: THREE.WebGLRenderTarget;
  private readonly environment: THREE.Texture;
  private readonly sun: THREE.DirectionalLight;
  private readonly skyCanvas = document.createElement("canvas");
  private readonly skyTexture: THREE.CanvasTexture;
  private readonly materials: StationMaterials;
  private readonly sharedMaterials: Set<THREE.Material>;
  private readonly library = new ModelLibrary();
  private readonly resizeObserver: ResizeObserver;
  private readonly keys = new Set<string>();
  private readonly joystick = new THREE.Vector2();
  private readonly screenUp = new THREE.Vector3(-CAMERA_OFFSET.x, 0, -CAMERA_OFFSET.z).normalize();
  private readonly screenRight = new THREE.Vector3(-this.screenUp.z, 0, this.screenUp.x);
  private readonly cameraFocus = new THREE.Vector3();
  private readonly reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private readonly timer = new THREE.Timer();

  private layout: StationLayout;
  private built: BuiltStation | null = null;
  private characters: CharacterFactory | null = null;
  private player: Player | null = null;
  private currentRoom: RoomLayout | null | undefined = undefined;
  private viewWidth = 0;
  private viewHeight = 0;
  private visibleHeight = 9;
  private mode: StationMode = "play";
  private isPaused = false;
  private readonly labelPoint = new THREE.Vector3();
  private frameId = 0;
  private elapsed = 0;
  private isDisposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: StationEngineOptions,
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      throw new WebGLUnavailableError();
    }
    if (!this.renderer.capabilities.isWebGL2) {
      this.renderer.dispose();
      throw new WebGLUnavailableError();
    }
    // Densidade limitada a 2: acima disso o brilho custa o triplo sem diferença visível (CB-11).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Sem curva de cinema: ela desbota as cores saturadas do estilo. A luz é calibrada para o branco não estourar.
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.environmentTarget = createEnvironmentTarget(this.renderer);
    this.environment = this.environmentTarget.texture;
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = DEFAULT_ENV_INTENSITY;
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTexture;

    // Desde a r155 a luz usa unidades físicas: as intensidades do protótipo (r147) são multiplicadas por π.
    this.scene.add(new THREE.HemisphereLight(0xece4ff, 0x2a1b55, 0.28 * Math.PI));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff6ec, 0.68 * Math.PI));
    sun.position.set(-25, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 40, bottom: -40, near: 1, far: 200 });
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    this.materials = createStationMaterials();
    this.sharedMaterials = new Set(Object.values(this.materials).flatMap((value) => (value instanceof THREE.Material ? [value] : [])));
    this.layout = resolveLayout(options.templateKey, options.roomNames);
    this.finish = new FinishPipeline(this.renderer, this.scene, this.camera, (tier) => this.options.onEvent({ type: "qualityChange", tier }));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    this.renderer.domElement.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  async start(): Promise<void> {
    try {
      await Promise.all([this.library.loadFurniture(), this.library.loadCharacters()]);
    } catch (error) {
      if (this.isDisposed) return;
      console.error("[orbita-station] falha ao carregar os modelos 3D", error);
      this.options.onEvent({ type: "error", message: "Não foi possível carregar os modelos 3D da estação." });
      return;
    }
    // Saiu da página durante o carregamento: nada é adicionado a uma cena já liberada (CB-6).
    if (this.isDisposed || !this.library.characters) return;
    this.characters = new CharacterFactory(this.library.characters);
    this.rebuildStation();
    this.spawnPlayer(this.options.look);
    this.resize();
    this.timer.reset();
    this.options.onEvent({ type: "ready" });
    this.frameId = requestAnimationFrame(this.frame);
  }

  /** Remonta a estação com outro modelo ou outros nomes de sala. Quem fica fora do piso novo volta ao Terminal (RF-3). */
  setStation(templateKey: string, roomNames: Readonly<Record<string, string>>) {
    this.layout = resolveLayout(templateKey, roomNames);
    if (!this.characters) return;
    this.rebuildStation();
    if (!this.player || !this.built) return;
    this.player.route = [];
    const { x, z } = this.player.position;
    const isStillOnFloor = isWalkable(this.layout, x, z) && !hitsObstacle(this.built.obstacles, x, z, PLAYER_RADIUS);
    if (!isStillOnFloor) {
      const spawn = spawnPoint(this.layout);
      this.player.position.set(spawn.x, 0, spawn.z);
      this.cameraFocus.copy(this.player.position);
    }
    this.currentRoom = undefined;
  }

  setLook(look: AvatarLook) {
    if (!this.characters || !this.player) return;
    const { position, facing } = this.player;
    disposeObject(this.player.rig.root, this.sharedMaterials);
    this.player.rig = this.characters.build(look);
    this.bindEnvironment(this.player.rig.root);
    this.player.rig.root.position.copy(position);
    this.player.rig.root.rotation.y = facing;
    this.scene.add(this.player.rig.root);
  }

  setQuality(tier: QualityTier) {
    this.finish.setTier(tier);
  }

  setMode(mode: StationMode) {
    this.mode = mode;
  }

  /** O estúdio cobre a estação: pausar evita desenhar a cena inteira por baixo dele à toa. */
  setPaused(isPaused: boolean) {
    this.isPaused = isPaused;
  }

  walkToRoom(roomKey: string) {
    const room = this.layout.rooms.find((candidate) => candidate.key === roomKey);
    if (!room || !this.player) return;
    this.player.route = planRouteToRoom(this.layout, this.player.position, room).map((point) => new THREE.Vector3(point.x, 0, point.z));
  }

  roomLabels(): RoomLabel[] {
    if (this.viewWidth === 0) return [];
    return this.layout.rooms.map((room) => {
      this.labelPoint.set(room.cx, 2.6, room.cz).project(this.camera);
      return {
        key: room.key,
        name: room.name,
        module: room.module,
        color: ROOM_KINDS[room.kind].color,
        x: ((this.labelPoint.x + 1) / 2) * this.viewWidth,
        y: ((1 - this.labelPoint.y) / 2) * this.viewHeight,
      };
    });
  }

  /** Prévia do estúdio num canvas próprio. Devolve `null` antes de os modelos carregarem. */
  openStudio(host: HTMLElement, look: AvatarLook): StudioPreview | null {
    if (!this.characters) return null;
    return new StudioPreview(host, this.characters, look);
  }

  /** Joystick de toque: x para a direita e y para cima da tela, de -1 a 1. */
  setMoveInput(x: number, y: number) {
    this.joystick.set(x, y);
  }

  zoomBy(factor: number) {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.camera.updateProjectionMatrix();
  }

  captureImage(): Promise<Blob | null> {
    this.finish.render();
    return new Promise((resolve) => this.renderer.domElement.toBlob(resolve, "image/png"));
  }

  dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    this.renderer.domElement.removeEventListener("wheel", this.handleWheel);
    if (this.built) disposeObject(this.built.root, this.sharedMaterials);
    if (this.player) disposeObject(this.player.rig.root, this.sharedMaterials);
    this.characters?.dispose();
    this.library.dispose();
    this.sharedMaterials.forEach((material) => material.dispose());
    this.materials.textures.forEach((texture) => texture.dispose());
    this.skyTexture.dispose();
    this.environmentTarget.dispose();
    this.sun.shadow.dispose();
    this.finish.dispose();
    this.renderer.dispose();
    // Devolve o contexto WebGL na hora, sem esperar o coletor de lixo (CA-6).
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private rebuildStation() {
    if (this.built) disposeObject(this.built.root, this.sharedMaterials);
    this.built = buildStation(this.layout, this.materials, this.library);
    this.bindEnvironment(this.built.root);
    this.scene.add(this.built.root);
  }

  private spawnPlayer(look: AvatarLook) {
    const spawn = spawnPoint(this.layout);
    const rig = this.characters!.build(look);
    this.bindEnvironment(rig.root);
    this.scene.add(rig.root);
    this.player = { rig, position: new THREE.Vector3(spawn.x, 0, spawn.z), velocity: new THREE.Vector3(), facing: 0, isWalking: false, route: [] };
    this.cameraFocus.copy(this.player.position);
  }

  // Desde a r163, com o reflexo vindo de `scene.environment`, o Three.js usa `scene.environmentIntensity` e ignora
  // o `envMapIntensity` do material. Quem pede outra intensidade (vidro, capacete, visor) recebe o mapa direto,
  // e aí o valor do próprio material volta a valer.
  private bindEnvironment(root: THREE.Object3D) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial && material.envMapIntensity !== DEFAULT_ENV_INTENSITY) material.envMap = this.environment;
      });
    });
  }

  // A câmera olha a estação na diagonal: o enquadramento sai dos cantos da estação vistos por ela,
  // não só do comprimento do corredor. Com o celular em pé, as pontas cortavam.
  private mapHeight() {
    const aspect = this.viewWidth / Math.max(this.viewHeight, 1);
    const halfLength = this.layout.hallLength / 2 + 1;
    const halfDepth = ROOM_OFFSET_Z + ROOM_DEPTH / 2 + 0.5;
    const view = new THREE.Matrix4().lookAt(CAMERA_OFFSET, new THREE.Vector3(), THREE.Object3D.DEFAULT_UP).setPosition(CAMERA_OFFSET).invert();
    let maxRight = 0;
    let maxUp = 0;
    const corner = new THREE.Vector3();
    [-halfLength, halfLength].forEach((x) =>
      [-halfDepth, halfDepth].forEach((z) =>
        [-2, 3].forEach((y) => {
          corner.set(x, y, z).applyMatrix4(view);
          maxRight = Math.max(maxRight, Math.abs(corner.x));
          maxUp = Math.max(maxUp, Math.abs(corner.y));
        }),
      ),
    );
    return Math.max(maxUp * 2, (maxRight * 2) / aspect) * 1.08;
  }

  private playHeight() {
    const aspect = this.viewWidth / Math.max(this.viewHeight, 1);
    return aspect < 0.8 ? (22 / aspect) * 0.55 : 17;
  }

  private applyCameraSize() {
    const aspect = this.viewWidth / Math.max(this.viewHeight, 1);
    this.camera.left = (-this.visibleHeight * aspect) / 2;
    this.camera.right = (this.visibleHeight * aspect) / 2;
    this.camera.top = this.visibleHeight / 2;
    this.camera.bottom = -this.visibleHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  // Com o canvas em tamanho zero (aba oculta, painel fechado) a proporção vira 0/0 e a projeção vira NaN:
  // a tela ficava preta para sempre no protótipo. Aqui o tamanho zero só é ignorado até o canvas ganhar tamanho (CB-2).
  private resize() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width === 0 || height === 0) return;
    this.viewWidth = width;
    this.viewHeight = height;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.finish.setSize(width, height);
    this.applyCameraSize();
    drawSky(this.skyCanvas, width, height);
    this.skyTexture.needsUpdate = true;
  }

  private readonly frame = (timestamp: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.05);
    this.elapsed += delta;
    if (this.viewWidth === 0 || this.isPaused) return;
    this.updatePlayer(delta);
    this.updateRoom();
    this.animateWorld(delta);
    this.updateCamera(delta);
    this.finish.render();
    this.finish.watchSpeed(delta);
  };

  private updatePlayer(delta: number) {
    const player = this.player;
    if (!player || !this.built) return;
    const direction = new THREE.Vector3();
    this.keys.forEach((key) => {
      const [right, up] = MOVE_KEYS[key];
      direction.addScaledVector(this.screenRight, right).addScaledVector(this.screenUp, up);
    });
    direction.addScaledVector(this.screenRight, this.joystick.x).addScaledVector(this.screenUp, this.joystick.y);
    if (direction.lengthSq() > 0.01) {
      // Mexer no teclado ou no joystick cancela a caminhada automática.
      player.route = [];
    } else if (player.route.length) {
      direction.copy(player.route[0]).sub(player.position).setY(0);
      if (direction.length() < 0.3) {
        player.route.shift();
        direction.set(0, 0, 0);
      }
    }
    if (direction.lengthSq() > 1) direction.normalize();
    player.velocity.lerp(direction.multiplyScalar(WALK_SPEED), 1 - Math.exp(-delta * 14));
    if (player.velocity.lengthSq() > 0.05) {
      const before = player.position.clone();
      const next = moveWithCollision(this.layout, this.built.obstacles, player.position, player.velocity.x * delta, player.velocity.z * delta);
      player.position.set(next.x, 0, next.z);
      player.facing += wrapAngle(Math.atan2(player.velocity.x, player.velocity.z) - player.facing) * Math.min(delta * 14, 1);
      const moved = before.distanceTo(player.position);
      player.isWalking = moved > 0.01;
      // Preso num móvel a caminho do ponto: desiste dele e segue para o próximo.
      if (player.route.length && moved < 0.002) player.route.shift();
    } else {
      player.isWalking = false;
    }
    player.rig.root.position.copy(player.position);
    player.rig.root.rotation.y = player.facing;
    player.rig.update(delta, player.isWalking);
  }

  private updateRoom() {
    if (!this.player || !this.built) return;
    const room = roomAt(this.layout, this.player.position.x, this.player.position.z);
    if (room?.key === this.currentRoom?.key && this.currentRoom !== undefined) return;
    const isFirst = this.currentRoom === undefined;
    this.currentRoom = room;
    if (room && !isFirst) {
      const visual = this.built.rooms.find((candidate) => candidate.layout.key === room.key);
      if (visual) visual.enterGlow = 1;
    }
    this.options.onEvent({ type: "roomChange", room });
  }

  private animateWorld(delta: number) {
    if (!this.built) return;
    const playerPosition = this.player?.position;
    this.built.rooms.forEach((visual) => {
      const { layout } = visual;
      if (!this.reduceMotion) {
        visual.ring?.scale.setScalar(1 + Math.sin(this.elapsed * 3) * 0.08);
        if (visual.spinner) visual.spinner.rotation.z += delta * 0.6;
        visual.screens.forEach((screen, index) => {
          (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.75 + Math.sin(this.elapsed * 3 + index) * 0.2;
        });
      }
      const isNearDoor = !!playerPosition && Math.hypot(playerPosition.x - layout.cx, playerPosition.z - layout.doorWallZ) < 2.8;
      visual.doorOpen += ((isNearDoor ? 1 : 0) - visual.doorOpen) * Math.min(delta * 8, 1);
      visual.doorPanels.forEach((panel) => {
        panel.position.x = panel.userData.closedX + panel.userData.side * visual.doorOpen * (DOOR_WIDTH / 2 + 0.05);
      });
      if (visual.enterGlow > 0) {
        visual.enterGlow = Math.max(0, visual.enterGlow - delta * 1.5);
        visual.floorMaterial.emissive.set(ROOM_KINDS[layout.kind].color);
        visual.floorMaterial.emissiveIntensity = visual.enterGlow * 0.35;
      }
    });
  }

  private updateCamera(delta: number) {
    if (!this.player) return;
    const isMap = this.mode === "map";
    const target = isMap ? new THREE.Vector3() : this.player.position.clone().addScaledVector(this.player.velocity, 0.25).setY(0);
    this.cameraFocus.lerp(target, 1 - Math.exp(-delta * (isMap ? 3 : 5)));
    this.visibleHeight += ((isMap ? this.mapHeight() : this.playHeight()) - this.visibleHeight) * (1 - Math.exp(-delta * 3));
    this.applyCameraSize();
    this.camera.position.copy(this.cameraFocus).add(CAMERA_OFFSET);
    this.camera.lookAt(this.cameraFocus);
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (!(key in MOVE_KEYS)) return;
    event.preventDefault();
    this.keys.add(key);
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private readonly handleBlur = () => {
    this.keys.clear();
    this.joystick.set(0, 0);
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
  };
}
