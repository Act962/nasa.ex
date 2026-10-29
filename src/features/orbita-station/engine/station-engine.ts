// Motor da Órbita Station: Three.js puro, sem React. A interface conversa com ele pelos métodos públicos e
// pelos eventos de `onEvent` (spec 0117, D-2). Tudo que ele cria é liberado em `dispose` (RNF-4).
import * as THREE from "three";
import { leadLook, type AvatarLook } from "../lib/avatar-look";
import {
  DOOR_WIDTH,
  PLAYER_RADIUS,
  ROOM_DEPTH,
  doorWaypoints,
  hitsObstacle,
  isWalkable,
  lockedDoorNear,
  ROOM_OFFSET_Z,
  moveWithCollision,
  planRouteToRoom,
  resolveLayout,
  roomAt,
  spawnPoint,
  type RoomLayout,
  type StationLayout,
} from "../layout/station-layout";
import { findPath, stopShortOf } from "../layout/path-finding";
import { ROOM_KINDS } from "../layout/room-kinds";
import { buildStation, type BuiltStation } from "./build-structure";
import { CharacterFactory, type CharacterRig } from "./character";
import { FinishPipeline, createEnvironmentTarget, type QualityTier } from "./finish";
import { DEFAULT_ENV_INTENSITY, createStationMaterials, glowMaterial, type StationMaterials } from "./materials";
import { ModelLibrary } from "./model-library";
import { PortalEffects } from "./portal";
import { addBox, disposeObject } from "./primitives";
import { StudioPreview } from "./studio-preview";

/** A ação que o botão de proximidade oferece agora (spec 0120, RF-5), na ordem de prioridade. */
export type StationInteraction =
  | { kind: "colleague"; id: string; name: string }
  | { kind: "lead"; id: string; name: string }
  | { kind: "lockedDoor"; room: RoomLayout }
  | { kind: "room"; room: RoomLayout };

export type StationEngineEvent =
  | { type: "ready" }
  | { type: "roomChange"; room: RoomLayout | null }
  | { type: "interactionChange"; interaction: StationInteraction | null }
  | { type: "lockedDoor"; room: RoomLayout }
  | { type: "qualityChange"; tier: QualityTier }
  | { type: "error"; message: string };

export interface StationEngineOptions {
  templateKey: string;
  roomNames: Readonly<Record<string, string>>;
  look: AvatarLook;
  /** Apps da matriz que a pessoa pode ver, vindos do servidor: decidem as portas trancadas (spec 0120, RF-2). */
  appAccess: Readonly<Record<string, boolean>>;
  onEvent: (event: StationEngineEvent) => void;
}

/** Colega na estação, para os painéis. `isRestricted`: está numa sala trancada para quem olha (RF-8). */
export interface ColleagueInfo {
  id: string;
  name: string;
  room: RoomLayout | null;
  isRestricted: boolean;
}

export type StationMode = "play" | "map";

/** Etiqueta de sala para a interface desenhar por cima do canvas, em pixels CSS. */
export interface RoomLabel {
  key: string;
  name: string;
  module: string;
  color: string;
  isLocked: boolean;
  x: number;
  y: number;
}

/** Nome de um colega por cima do personagem dele, em pixels CSS. */
export interface RemoteLabel {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Lead esperando resposta no chat (spec 0121, RF-10): só o que o motor precisa para desenhar a fila. */
export interface QueueLeadInput {
  id: string;
  name: string;
}

/** Ponto da tela por cima de um lead da fila, ou da etiqueta "+N aguardando" (`id` = null). */
export interface QueueLabel {
  id: string | null;
  overflow: number;
  x: number;
  y: number;
}

/** Posição do próprio personagem, para a presença enviar aos colegas. */
export interface PlayerState {
  x: number;
  z: number;
  facing: number;
  isWalking: boolean;
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
const TALK_DISTANCE = 2.3;
const BUMP_NOTICE_MS = 2_200;
const LOCK_COLOR = 0xff4f6d;
const QUEUE_SPOTS = 8;
const QUEUE_WALK_SPEED = 3.4;

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

/** Colega da mesma empresa na estação. A posição recebida vira alvo e o personagem anda até ela (RF-7). */
interface RemoteAvatar {
  name: string;
  lookKey: string;
  rig: CharacterRig;
  position: THREE.Vector3;
  target: THREE.Vector3;
  facing: number;
  targetFacing: number;
  isWalking: boolean;
  hasPosition: boolean;
  /** O portal de chegada já abriu: antes disso o personagem fica escondido (RF-9). */
  hasArrived: boolean;
  room: RoomLayout | null;
}

/** Lead da fila: entra pelo portal, anda até o lugar dele e, quando é atendido, sai pelo portal. */
interface QueueLead {
  name: string;
  rig: CharacterRig;
  position: THREE.Vector3;
  route: THREE.Vector3[];
  state: "arriving" | "waiting" | "leaving";
  isHidden: boolean;
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
  private readonly remotes = new Map<string, RemoteAvatar>();
  private readonly portals: PortalEffects;
  /** Colegas que já saíram, esperando o portal abrir para sumir. */
  private readonly leavingRigs = new Set<CharacterRig>();
  private readonly lockMaterial = glowMaterial({ color: LOCK_COLOR });
  /** Tremor da porta trancada, por chave de sala: vai de 1 a 0 depois do esbarrão (RF-3). */
  private readonly doorShake = new Map<string, number>();
  private lastBumpAt = 0;
  private interactionKey: string | null = null;
  private readonly queueLeads = new Map<string, QueueLead>();
  private waitingLeads: readonly QueueLeadInput[] = [];
  private queueOverflow = 0;
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
    this.sharedMaterials.add(this.lockMaterial);
    this.portals = new PortalEffects(this.scene, this.reduceMotion);
    this.layout = resolveLayout(options.templateKey, options.roomNames);
    this.finish = new FinishPipeline(this.renderer, this.scene, this.camera, (tier) => this.options.onEvent({ type: "qualityChange", tier }));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
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
    this.setWaitingLeads(this.waitingLeads, this.queueOverflow);
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
    // A sala do chat pode ter mudado de lugar ou sumido: a fila é remontada do zero, sem portal.
    this.queueLeads.forEach((lead) => disposeObject(lead.rig.root, this.sharedMaterials));
    this.queueLeads.clear();
    this.setWaitingLeads(this.waitingLeads, this.queueOverflow);
    if (!this.player || !this.built) return;
    this.player.route = [];
    const { x, z } = this.player.position;
    const isStillOnFloor = isWalkable(this.layout, x, z, this.isRoomOpen) && !hitsObstacle(this.built.obstacles, x, z, PLAYER_RADIUS);
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

  /** Sala trancada: o personagem para no corredor, em frente à porta (RF-4). */
  walkToRoom(roomKey: string) {
    const room = this.layout.rooms.find((candidate) => candidate.key === roomKey);
    if (!room || !this.player || !this.built) return;
    const doorRoute = planRouteToRoom(this.layout, this.player.position, room, !this.isRoomOpen(room));
    const target = doorRoute[doorRoute.length - 1];
    // O destino continua o da porta (dentro da sala, ou no corredor se ela está trancada); o caminho desvia dos móveis.
    const path = findPath(this.layout, this.built.obstacles, this.player.position, target, this.isRoomOpen) ?? doorRoute;
    this.player.route = path.map(toFloorPoint);
  }

  /** Anda até perto de um colega, desviando dos móveis. Colega em sala trancada não é alcançável (RF-8). */
  walkToColleague(id: string) {
    const remote = this.remotes.get(id);
    if (!remote?.hasPosition || !this.player || !this.built || (remote.room && !this.isRoomOpen(remote.room))) return;
    const from = this.player.position;
    const path = findPath(this.layout, this.built.obstacles, from, remote.position, this.isRoomOpen);
    if (!path) return;
    // Para um pouco antes, em vez de entrar no colega.
    this.player.route = stopShortOf(from, path, 1.2).map(toFloorPoint);
  }

  /**
   * Fila de leads do NasaChat (spec 0121, RF-10). Quem entrou na lista chega pelo portal; quem saiu vai embora por ele.
   * `overflow`: quantos esperam além dos que cabem na sala ("+N aguardando").
   */
  setWaitingLeads(leads: readonly QueueLeadInput[], overflow: number) {
    this.waitingLeads = leads.slice(0, QUEUE_SPOTS);
    this.queueOverflow = overflow;
    const chat = this.chatRoom();
    if (!this.characters || !chat) return;
    const door = doorWaypoints(chat);
    const wanted = new Set(this.waitingLeads.map((lead) => lead.id));
    this.queueLeads.forEach((lead, id) => {
      if (wanted.has(id) || lead.state === "leaving") return;
      lead.state = "leaving";
      lead.route = [door.inside, door.outside].map(toFloorPoint);
    });
    this.waitingLeads.forEach((input, index) => {
      const spot = this.queueSpot(chat, index);
      const existing = this.queueLeads.get(input.id);
      if (existing && existing.state !== "leaving") {
        existing.name = input.name;
        // Ainda chegando pela porta: troca só o destino final, para não cortar caminho pela parede.
        existing.route = existing.state === "arriving" && existing.route.length > 1 ? [existing.route[0], spot] : [spot];
        return;
      }
      if (existing) {
        disposeObject(existing.rig.root, this.sharedMaterials);
        this.queueLeads.delete(input.id);
      }
      const rig = this.characters!.build(leadLook(input.id));
      this.bindEnvironment(rig.root);
      rig.root.visible = false;
      this.scene.add(rig.root);
      const lead: QueueLead = {
        name: input.name,
        rig,
        position: new THREE.Vector3(door.outside.x, 0, door.outside.z),
        route: [toFloorPoint(door.inside), spot],
        state: "arriving",
        isHidden: true,
      };
      this.queueLeads.set(input.id, lead);
      this.portals.open(door.outside.x, door.outside.z, {
        onOpen: () => {
          lead.isHidden = false;
        },
      });
    });
  }

  queueLabels(): QueueLabel[] {
    if (this.viewWidth === 0) return [];
    const labels: QueueLabel[] = [];
    this.queueLeads.forEach((lead, id) => {
      if (!lead.rig.root.visible || lead.state === "leaving") return;
      labels.push({ id, overflow: 0, ...this.toScreen(lead.position.x, 2.3, lead.position.z) });
    });
    const chat = this.chatRoom();
    if (chat && this.queueOverflow > 0 && this.isRoomOpen(chat)) {
      // Ao lado da primeira fileira, para não cobrir o tempo de ninguém.
      const spot = this.queueSpot(chat, 3);
      labels.push({ id: null, overflow: this.queueOverflow, ...this.toScreen(spot.x + 1.6, 1.6, spot.z) });
    }
    return labels;
  }

  firstRoomOfKind(kind: RoomLayout["kind"]): RoomLayout | null {
    return this.layout.rooms.find((room) => room.kind === kind) ?? null;
  }

  colleagues(): ColleagueInfo[] {
    return [...this.remotes.entries()]
      .filter(([, remote]) => remote.hasPosition)
      .map(([id, remote]) => ({ id, name: remote.name, room: remote.room, isRestricted: !!remote.room && !this.isRoomOpen(remote.room) }));
  }

  isRoomOpenForMe(roomKey: string): boolean {
    const room = this.layout.rooms.find((candidate) => candidate.key === roomKey);
    return !room || this.isRoomOpen(room);
  }

  /** Aceno do próprio personagem e, se houver, do colega com quem ele fala (RF-7). */
  wave(colleagueId?: string) {
    this.player?.rig.wave();
    if (colleagueId) this.remoteWave(colleagueId);
  }

  remoteWave(id: string) {
    const remote = this.remotes.get(id);
    if (remote?.hasPosition) remote.rig.wave();
  }

  getPlayerState(): PlayerState | null {
    if (!this.player) return null;
    const { position, facing, isWalking } = this.player;
    return { x: position.x, z: position.z, facing, isWalking };
  }

  /** Cria o colega, ou troca o visual dele. Ele só aparece depois da primeira posição. */
  upsertRemote(id: string, name: string, look: AvatarLook) {
    if (!this.characters) return;
    const lookKey = JSON.stringify(look);
    const existing = this.remotes.get(id);
    if (existing) {
      existing.name = name;
      if (existing.lookKey === lookKey) return;
      disposeObject(existing.rig.root, this.sharedMaterials);
      existing.rig = this.buildRemoteRig(look, existing.position, existing.facing, existing.hasPosition);
      existing.lookKey = lookKey;
      return;
    }
    const position = new THREE.Vector3();
    this.remotes.set(id, {
      name,
      lookKey,
      rig: this.buildRemoteRig(look, position, 0, false),
      position,
      target: new THREE.Vector3(),
      facing: 0,
      targetFacing: 0,
      isWalking: false,
      hasPosition: false,
      hasArrived: false,
      room: null,
    });
  }

  setRemoteState(id: string, state: PlayerState) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    remote.target.set(state.x, 0, state.z);
    remote.targetFacing = state.facing;
    remote.isWalking = state.isWalking;
    // Primeira posição (ou um salto grande, como a volta ao Terminal): aparece no lugar, sem atravessar a estação.
    const isFirstPosition = !remote.hasPosition;
    if (isFirstPosition || remote.position.distanceTo(remote.target) > 8) {
      remote.position.copy(remote.target);
      remote.facing = state.facing;
      remote.hasPosition = true;
      remote.room = roomAt(this.layout, remote.position.x, remote.position.z);
    }
    // Chega pelo portal: aparece quando o cilindro termina de subir (RF-9).
    if (isFirstPosition) {
      this.portals.open(remote.position.x, remote.position.z, {
        onOpen: () => {
          remote.hasArrived = true;
        },
      });
    }
  }

  hasRemote(id: string): boolean {
    return this.remotes.has(id);
  }

  /** Sai pelo portal: o personagem some no clarão e só então é liberado (RF-9). */
  removeRemote(id: string) {
    const remote = this.remotes.get(id);
    if (!remote) return;
    this.remotes.delete(id);
    if (!remote.rig.root.visible || this.isDisposed) {
      disposeObject(remote.rig.root, this.sharedMaterials);
      return;
    }
    this.leavingRigs.add(remote.rig);
    this.portals.open(remote.position.x, remote.position.z, {
      onOpen: () => {
        this.leavingRigs.delete(remote.rig);
        disposeObject(remote.rig.root, this.sharedMaterials);
      },
    });
  }

  private toScreen(x: number, y: number, z: number) {
    this.labelPoint.set(x, y, z).project(this.camera);
    return { x: ((this.labelPoint.x + 1) / 2) * this.viewWidth, y: ((1 - this.labelPoint.y) / 2) * this.viewHeight };
  }

  private chatRoom(): RoomLayout | null {
    return this.firstRoomOfKind("chat");
  }

  // Duas fileiras de 4 depois da porta, de frente para os guichês.
  private queueSpot(chat: RoomLayout, index: number): THREE.Vector3 {
    const inside = doorWaypoints(chat).inside;
    const column = index % 4;
    const row = Math.floor(index / 4);
    return new THREE.Vector3(chat.cx + (column - 1.5) * 1.3, 0, inside.z - chat.towardDoor * (1.6 + row * 1.4));
  }

  private updateQueue(delta: number) {
    const chat = this.chatRoom();
    const isChatVisible = !!chat && this.isRoomOpen(chat);
    this.queueLeads.forEach((lead, id) => {
      const target = lead.route[0];
      let isWalking = false;
      if (target && !lead.isHidden) {
        const toTarget = target.clone().sub(lead.position).setY(0);
        const distance = toTarget.length();
        const stride = QUEUE_WALK_SPEED * delta;
        if (distance <= stride) {
          lead.position.copy(target);
          lead.route.shift();
        } else {
          lead.position.addScaledVector(toTarget.normalize(), stride);
          lead.rig.root.rotation.y = Math.atan2(toTarget.x, toTarget.z);
          isWalking = true;
        }
      }
      if (!lead.route.length && lead.state === "arriving") lead.state = "waiting";
      if (lead.state === "waiting" && !lead.route.length && chat) lead.rig.root.rotation.y = chat.towardDoor > 0 ? Math.PI : 0;
      // Chegou ao corredor depois de atendido: some no portal e só então é liberado.
      if (lead.state === "leaving" && !lead.route.length && !lead.isHidden) {
        lead.isHidden = true;
        this.queueLeads.delete(id);
        this.leavingRigs.add(lead.rig);
        this.portals.open(lead.position.x, lead.position.z, {
          onOpen: () => {
            this.leavingRigs.delete(lead.rig);
            disposeObject(lead.rig.root, this.sharedMaterials);
          },
        });
        return;
      }
      lead.rig.root.position.copy(lead.position);
      lead.rig.root.visible = isChatVisible && !lead.isHidden;
      lead.rig.update(delta, isWalking);
    });
  }

  remoteLabels(): RemoteLabel[] {
    if (this.viewWidth === 0) return [];
    const labels: RemoteLabel[] = [];
    this.remotes.forEach((remote, id) => {
      if (!remote.rig.root.visible) return;
      this.labelPoint.set(remote.position.x, 2.35, remote.position.z).project(this.camera);
      labels.push({
        id,
        name: remote.name,
        x: ((this.labelPoint.x + 1) / 2) * this.viewWidth,
        y: ((1 - this.labelPoint.y) / 2) * this.viewHeight,
      });
    });
    return labels;
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
        isLocked: !this.isRoomOpen(room),
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
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.renderer.domElement.removeEventListener("wheel", this.handleWheel);
    if (this.built) disposeObject(this.built.root, this.sharedMaterials);
    if (this.player) disposeObject(this.player.rig.root, this.sharedMaterials);
    this.remotes.forEach((remote) => disposeObject(remote.rig.root, this.sharedMaterials));
    this.remotes.clear();
    this.leavingRigs.forEach((rig) => disposeObject(rig.root, this.sharedMaterials));
    this.leavingRigs.clear();
    this.queueLeads.forEach((lead) => disposeObject(lead.rig.root, this.sharedMaterials));
    this.queueLeads.clear();
    this.portals.dispose();
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
    const built = buildStation(this.layout, this.materials, this.library);
    this.built = built;
    // Faixa vermelha no alto da porta das salas trancadas: dá para ver de longe, antes de esbarrar (RF-3).
    this.layout.rooms.forEach((room) => {
      if (this.isRoomOpen(room)) return;
      addBox(built.root, DOOR_WIDTH, 0.18, 0.72, this.lockMaterial, room.cx, 2.3, room.cz + room.towardDoor * (ROOM_DEPTH / 2));
    });
    this.doorShake.clear();
    this.bindEnvironment(built.root);
    this.scene.add(built.root);
  }

  private readonly isRoomOpen = (room: RoomLayout) => {
    const accessApp = ROOM_KINDS[room.kind].accessApp;
    return accessApp === null || this.options.appAccess[accessApp] === true;
  };

  private bumpLockedDoor(room: RoomLayout) {
    this.doorShake.set(room.key, 1);
    const now = performance.now();
    if (now - this.lastBumpAt < BUMP_NOTICE_MS) return;
    this.lastBumpAt = now;
    this.options.onEvent({ type: "lockedDoor", room });
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

  private buildRemoteRig(look: AvatarLook, position: THREE.Vector3, facing: number, isVisible: boolean): CharacterRig {
    const rig = this.characters!.build(look);
    this.bindEnvironment(rig.root);
    rig.root.position.copy(position);
    rig.root.rotation.y = facing;
    rig.root.visible = isVisible;
    this.scene.add(rig.root);
    return rig;
  }

  private updateRemotes(delta: number) {
    this.leavingRigs.forEach((rig) => rig.update(delta, false));
    this.remotes.forEach((remote) => {
      if (!remote.hasPosition) return;
      remote.room = roomAt(this.layout, remote.position.x, remote.position.z);
      // Colega numa sala trancada para mim não é desenhado. É só visual: a posição dele chega igual (spec 0120, D-3).
      remote.rig.root.visible = remote.hasArrived && (!remote.room || this.isRoomOpen(remote.room));
      const distance = remote.position.distanceTo(remote.target);
      // Persegue o alvo um pouco mais rápido que a caminhada: atraso de rede não vira personagem ficando para trás.
      remote.position.lerp(remote.target, 1 - Math.exp(-delta * 10));
      remote.facing += wrapAngle(remote.targetFacing - remote.facing) * Math.min(delta * 12, 1);
      remote.rig.root.position.copy(remote.position);
      remote.rig.root.rotation.y = remote.facing;
      remote.rig.update(delta, remote.isWalking || distance > 0.08);
    });
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
    this.updateRemotes(delta);
    this.updateQueue(delta);
    this.updateRoom();
    this.updateInteraction();
    this.animateWorld(delta);
    this.portals.update(delta, this.elapsed);
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
      const next = moveWithCollision(this.layout, this.built.obstacles, player.position, player.velocity.x * delta, player.velocity.z * delta, this.isRoomOpen);
      player.position.set(next.x, 0, next.z);
      if (next.lockedRoom) this.bumpLockedDoor(next.lockedRoom);
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

  // Uma ação por vez, na ordem da spec: colega perto, porta trancada à frente, a sala em que está (RF-5).
  private updateInteraction() {
    const player = this.player;
    let next: StationInteraction | null = null;
    if (player && this.mode === "play") {
      let nearestDistance = TALK_DISTANCE;
      this.remotes.forEach((remote, id) => {
        if (!remote.rig.root.visible) return;
        const distance = remote.position.distanceTo(player.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          next = { kind: "colleague", id, name: remote.name };
        }
      });
      if (!next) {
        this.queueLeads.forEach((lead, id) => {
          if (!lead.rig.root.visible || lead.state === "leaving") return;
          const distance = lead.position.distanceTo(player.position);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            next = { kind: "lead", id, name: lead.name };
          }
        });
      }
      if (!next) {
        const lockedRoom = lockedDoorNear(this.layout, player.position.x, player.position.z, this.isRoomOpen);
        if (lockedRoom) next = { kind: "lockedDoor", room: lockedRoom };
        else if (this.currentRoom) next = { kind: "room", room: this.currentRoom };
      }
    }
    const interaction = next as StationInteraction | null;
    const key = interaction ? `${interaction.kind}:${interaction.kind === "colleague" || interaction.kind === "lead" ? `${interaction.id}:${interaction.name}` : `${interaction.room.key}:${interaction.room.name}`}` : null;
    if (key === this.interactionKey) return;
    this.interactionKey = key;
    this.options.onEvent({ type: "interactionChange", interaction });
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
      // Porta trancada para mim fica fechada, mesmo com um colega passando por ela.
      const isOpenForMe = this.isRoomOpen(layout);
      const isNearDoorPoint = (point: THREE.Vector3) => Math.hypot(point.x - layout.cx, point.z - layout.doorWallZ) < 2.8;
      let isNearDoor = isOpenForMe && !!playerPosition && isNearDoorPoint(playerPosition);
      this.remotes.forEach((remote) => {
        if (isOpenForMe && remote.hasPosition && isNearDoorPoint(remote.position)) isNearDoor = true;
      });
      visual.doorOpen += ((isNearDoor ? 1 : 0) - visual.doorOpen) * Math.min(delta * 8, 1);
      const shake = this.doorShake.get(layout.key) ?? 0;
      if (shake > 0) this.doorShake.set(layout.key, Math.max(0, shake - delta * 2.5));
      const shakeOffset = this.reduceMotion ? 0 : Math.sin(this.elapsed * 60) * 0.06 * shake;
      visual.doorPanels.forEach((panel) => {
        panel.position.x = panel.userData.closedX + panel.userData.side * visual.doorOpen * (DOOR_WIDTH / 2 + 0.05) + shakeOffset;
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

  // Aba escondida: o navegador quase para o loop de quadros. O personagem para na hora, para os colegas não verem
  // alguém "andando parado" até a pessoa voltar (a presença manda a parada no próximo envio).
  private readonly handleVisibilityChange = () => {
    if (!document.hidden || !this.player) return;
    this.handleBlur();
    this.player.route = [];
    this.player.velocity.set(0, 0, 0);
    this.player.isWalking = false;
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
  };
}

function toFloorPoint(point: { x: number; z: number }) {
  return new THREE.Vector3(point.x, 0, point.z);
}
