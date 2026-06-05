import type Phaser from "phaser";
import type { AvatarConfig, StationWorldConfig, WorldMapData, WorldElementsConfig, RoomConfig, RoomType, PlacedMapObject, MapArea, AreaType, TileLayer, TileCell, TileTextureKey } from "../../../types";
import { DEFAULT_ELEMENTS, DEFAULT_ROOMS, ROOM_META, AREA_TYPE_META } from "../../../types";
import { buildVisorSpritesheet } from "../../../utils/composite-visor";
import { getDefaultSpriteForUser, resolveSpriteUrl, resolveRemoteSpriteUrl } from "../../../utils/sprite-defaults";
import { buildCompositeSpritesheet } from "../../../utils/composite-spritesheet";

const T = 32;
const MW = 80;
const MH = 50;
const WORLD_W = MW * T;
const WORLD_H = MH * T;
const OFFICE_ROWS = 30;
const OFFICE_H = OFFICE_ROWS * T;

// Room column config
const ROOM_COL_X = 62 * T;   // right rooms start here
const ROOM_W     = 18 * T;   // room width
const ROOM_H     = 8 * T;    // room height
const ROOM_GAP   = 2 * T;    // corridor between rooms
const DOOR_W     = 2 * T;    // door width (on left wall)
const WALL_T     = T;        // wall thickness

const C = {
  WALL:          0x5a4e3e,
  WALL_INT:      0x9a8e80,
  WALL_DOOR:     0xd4c4b0,   // door opening (floor color)
  FLOOR:         0xd8d0c4,
  FLOOR_LINE:    0xc8beb0,
  CORRIDOR:      0xe8e0d4,
  DESK_TOP:      0xc4a882,
  DESK_EDGE:     0x9e8060,
  MONITOR:       0x1a2535,
  MONITOR_GLOW:  0x2a6aff,
  DESK_SPACE:    0x1a2a3a,
  DESK_SPACE_GL: 0x00d4ff,
  CHAIR_OFFICE:  0x6a7e8a,
  CHAIR_SEAT:    0x8a9ba8,
  CHAIR_ROCKET:  0x1a1a2e,
  CHAIR_RPAD:    0x2a3a5e,
  // Room floors
  ROOM_COPA:     0xd4c4a0,
  ROOM_COZINHA:  0xccd4c0,
  ROOM_ATEND:    0xc4d0d8,
  ROOM_COWRK:    0xddd5c8,
  ROOM_REUNIAO:  0xc8d4d8,
  ROOM_RECEPCAO: 0xd0c8d8,
  // Outdoor
  GRASS:         0x5fa83c,
  GRASS_DARK:    0x4a8a2c,
  GRASS_LIGHT:   0x79c94e,
  TREE_TOP:      0x27a653,
  TREE_SHADOW:   0x156632,
  TRUNK:         0x7a5530,
  WATER:         0x3a8fd4,
  WATER_DARK:    0x2a70b0,
  WATER_LIGHT:   0x70c0f0,
  PATH:          0xc8b890,
  FLOWER_R:      0xe85050,
  FLOWER_Y:      0xf0c030,
  FLOWER_W:      0xf0f0f0,
  // Space scenario
  SPACE_BG:      0x020210,
  NEBULA1:       0x3a1060,
  NEBULA2:       0x0a1850,
  ASTEROID:      0x4a3e30,
  ASTEROID_LIT:  0x6a5e50,
  PLATFORM:      0x1a2a3a,
  PLATFORM_GLOW: 0x00d4ff,
  // Rocket scenario
  ROCKET_HULL:   0x1a1a2e,
  ROCKET_PANEL:  0x12122a,
  ROCKET_ACCENT: 0xff6b35,
  ROCKET_GLOW:   0xff8c42,
  ROCKET_GLASS:  0x4a8aaa,
  ROCKET_METAL:  0x2a3a5e,
  ROCKET_CON:    0x0a1520,
  LED_G:         0x00ff88,
  LED_R:         0xff3344,
  LED_B:         0x0088ff,
};

const ROOM_FLOOR_COLOR: Record<RoomType, number> = {
  copa:        C.ROOM_COPA,
  cozinha:     C.ROOM_COZINHA,
  atendimento: C.ROOM_ATEND,
  coworking:   C.ROOM_COWRK,
  reuniao:     C.ROOM_REUNIAO,
  recepcao:    C.ROOM_RECEPCAO,
};

interface RemotePlayer {
  gfx:              Phaser.GameObjects.Graphics;
  nameText:         Phaser.GameObjects.Text;
  sprite?:          Phaser.GameObjects.Sprite;
  loadedSpriteUrl:  string | null;
  /** URL que está sendo carregada agora (ainda não aplicada) */
  pendingSpriteUrl: string | null;
  /** Incrementado a cada nova carga — closures antigas verificam isso e se auto-cancelam */
  loadGen:          number;
  /** HTMLImageElement atual do load em curso — cancelado setando onload=null */
  _imgEl?:          HTMLImageElement;
}

/** Hash 32-bit estável para gerar chaves de textura a partir de URLs (evita duplicar load). */
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/* ─── LPC spritesheet constants ────────────────────────────────────────── */
// Standard Universal LPC format: 64×64 px per frame
// Row  8 = walk south (down),   Row  9 = walk west (left)
// Row 10 = walk north (up),     Row 11 = walk east (right)
// 9 frames per row: col 0 = idle, cols 1-8 = walk cycle
const LPC_FRAME      = 64;
const LPC_WALK_ROWS  = { down: 8, left: 9, up: 10, right: 11 } as const;
const LPC_WALK_FRAMES = 9;
// Player display scale for LPC sprites (64px → 32px logical)
const LPC_SCALE      = 0.5;

export class WorldScene extends (globalThis.Phaser?.Scene ?? class {}) {
  private player!: Phaser.Physics.Arcade.Image;
  /** Animated LPC sprite — used instead of `player` when lpcSpritesheetUrl is set */
  private lpcSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private playerLabel!: Phaser.GameObjects.Text;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  /** Atalhos WASD em paralelo às setas, somados via OR no update(). */
  private wasd!: {
    up:    Phaser.Input.Keyboard.Key;
    down:  Phaser.Input.Keyboard.Key;
    left:  Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private worldConfig?: StationWorldConfig;
  private avatarConfig?: AvatarConfig;
  private localUserId = "guest";
  private animFrame = 0;
  private animTimer = 0;
  private facingDir: "down" | "up" | "left" | "right" = "down";

  // ─── Proximity detection (for WebRTC) ────────────────────────
  private readonly PROXIMITY_RADIUS = T * 6;   // ~192px — ~6 tiles
  private nearbyPeers: Set<string> = new Set(); // currently in range

  // ─── Proximity circle visual ──────────────────────────────────
  private proximityCircle:      Phaser.GameObjects.Graphics | null = null;
  private proximityPulse:       Phaser.GameObjects.Graphics | null = null;
  private proximityPulseScale = 1;
  private proximityPulseDir   = 1;

  // ─── Zoom ─────────────────────────────────────────────────────
  private currentZoom = 1.6;
  private readonly ZOOM_MIN = 0.4;
  private readonly ZOOM_MAX = 3.5;
  private readonly ZOOM_STEP = 0.15;
  // Pinch-to-zoom
  private pinchDist: number | null = null;

  // ─── Map Editor: placed objects ──────────────────────────────
  private placedObjectSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private placedObjectHighlights: Map<string, Phaser.GameObjects.Graphics> = new Map();
  /** Corpos de física para objetos com solid:true */
  private placedObjectBodies: Map<string, Phaser.Physics.Arcade.Image> = new Map();
  private editorActive = false;
  private editorSelectedId: string | null = null;
  private placedObjectsState: PlacedMapObject[] = [];

  // ─── Map Editor: areas ───────────────────────────────────────
  private areaGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private areaLabels:   Map<string, Phaser.GameObjects.Text>     = new Map();
  private areaHitzones: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  /** Corpos de física para áreas type === "collision" */
  private areaCollisionBodies: Map<string, Phaser.Physics.Arcade.Image> = new Map();
  private areaSelectedId: string | null = null;
  private areasState: MapArea[] = [];
  private drawingAreaType: AreaType | null = null;
  private drawStart: { x: number; y: number } | null = null;
  private drawPreview: Phaser.GameObjects.Graphics | null = null;
  private cameraViewTickAcc = 0;
  /** Areas the player is currently inside (for enter/leave events) */
  private insideAreaIds: Set<string> = new Set();

  // ─── Tiled map (pré-renderizado como HTMLCanvasElement) ──────────
  private tiledCanvas:  HTMLCanvasElement | null = null;
  private tiledMapW  = WORLD_W;
  private tiledMapH  = WORLD_H;
  private tiledSpawnX = 0;
  private tiledSpawnY = 0;

  // ─── Tile Layer (Map Builder) ─────────────────────────────────
  private tileFloorGfx:    Phaser.GameObjects.Graphics | null = null;
  private tileWallGfx:     Phaser.GameObjects.Graphics | null = null;
  private tileDecoGfx:     Phaser.GameObjects.Graphics | null = null;
  /** Camada que renderiza acima do avatar (telhado, copa, etc.) */
  private tileOverlayGfx:  Phaser.GameObjects.Graphics | null = null;
  private tileWallBodies   = new Map<string, Phaser.Physics.Arcade.Image>();
  private tileLayerState:  TileLayer | null = null;
  private tileGridGfx:     Phaser.GameObjects.Graphics | null = null;
  private tileEditActive   = false;
  private tilePainting     = false;
  private tilePanning      = false;
  private panLastX         = 0;
  private panLastY         = 0;
  private currentTileTool: "paint" | "erase" | "fill" | "rect" | "rect-erase" | "pan" = "paint";
  private currentTileCell: TileCell = { texture: "floor_wood", layer: "floor", color: "#a0783c" };
  private _tileSyncTimer:  ReturnType<typeof setTimeout> | null = null;
  // Seleção retangular (tool "rect" / "rect-erase")
  private rectStart:       { tx: number; ty: number } | null = null;
  private rectPreviewGfx:  Phaser.GameObjects.Graphics | null = null;
  private rectPreviewEnd:  { tx: number; ty: number } | null = null;
  // ─── Resize handles ─────────────────────────────────────────────
  private resizeHandles:   Phaser.GameObjects.Rectangle[] = [];
  private resizeOrigScale  = 1;
  private resizeOrigDist   = 0;

  constructor() { super({ key: "WorldScene" }); }

  init(this: Phaser.Scene & WorldScene, data: {
    worldConfig:     StationWorldConfig;
    avatarConfig?:   AvatarConfig;
    channel?:        unknown;
    userImage?:      string | null;
    userId?:         string;
    tiledCanvas?:    HTMLCanvasElement | null;
    tiledWidthPx?:   number;
    tiledHeightPx?:  number;
    tiledSpawnX?:    number;
    tiledSpawnY?:    number;
  }) {
    this.worldConfig = data.worldConfig;
    this.avatarConfig = data.avatarConfig
      ? { ...data.avatarConfig, _photoUrl: data.userImage ?? undefined } as AvatarConfig
      : data.avatarConfig;
    if (data.userId) this.localUserId = data.userId;

    this.tiledCanvas  = data.tiledCanvas  ?? null;
    this.tiledMapW    = data.tiledWidthPx  || WORLD_W;
    this.tiledMapH    = data.tiledHeightPx || WORLD_H;
    this.tiledSpawnX  = data.tiledSpawnX   ?? 0;
    this.tiledSpawnY  = data.tiledSpawnY   ?? 0;
  }

  preload(this: Phaser.Scene & WorldScene) {
    // Cenário "image" — pré-carrega a imagem de fundo do user
    const raw = this.worldConfig?.mapData as WorldMapData | null;
    if (raw?.scenario === "image" && raw.backgroundImageUrl) {
      this.load.image("__bg_image__", raw.backgroundImageUrl);
    }
  }

  create(this: Phaser.Scene & WorldScene) {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Create blank texture for invisible physics bodies
    if (!this.textures.exists("__blank__")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.01);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("__blank__", 4, 4);
      g.destroy();
    }

    this.walls = this.physics.add.staticGroup();

    const raw = this.worldConfig?.mapData as WorldMapData | null;
    const scenario        = raw?.scenario         ?? "station";
    const elements: WorldElementsConfig = { ...DEFAULT_ELEMENTS, ...(raw?.elements ?? {}) };
    const rooms: RoomConfig[] = raw?.rooms ?? DEFAULT_ROOMS;
    const meetingCount    = raw?.meetingRoomCount  ?? 2;

    if      (scenario === "tiled")            this.renderTiledMap();
    else if (scenario === "image")            this.renderImageBackground();
    else if (scenario === "station")         this.drawStation(elements, rooms, meetingCount);
    else if (scenario === "space")           this.drawSpace();
    else if (scenario === "rocket")          this.drawRocket();
    else if (scenario === "lunar_base")      this.drawLunarBase();
    else if (scenario === "mission_control") this.drawMissionControl();
    else if (scenario === "lab")             this.drawLab();
    else if (scenario === "hangar")          this.drawHangar();
    else if (scenario === "mars")            this.drawMars();
    else if (scenario === "observatory")     this.drawObservatory();
    else if (scenario === "bridge")          this.drawBridge();
    else if (scenario === "custom") {
      const bgColor = raw?.tileLayer?.bgColor ?? "#1a1a2e";
      const bgInt   = parseInt(bgColor.replace("#", ""), 16);
      this.add.rectangle(0, 0, WORLD_W, WORLD_H, bgInt).setOrigin(0, 0).setDepth(0);
    } else                                   this.drawStation(elements, rooms, meetingCount);

    // Render tile layer on top of any scenario (applies to "custom" and overlays on others)
    const tileLayer = raw?.tileLayer;
    if (tileLayer) {
      this.tileLayerState = tileLayer;
      this.tileFloorGfx   = this.add.graphics().setDepth(1);
      this.tileWallGfx    = this.add.graphics().setDepth(3);
      this.tileDecoGfx    = this.add.graphics().setDepth(15);
      // Avatar fica em ~depth 20-21 → overlay em 30 fica acima dele
      this.tileOverlayGfx = this.add.graphics().setDepth(30);
      this.syncTileRendering();
    }

    const rawLpcUrl = (this.avatarConfig as (AvatarConfig & { lpcSpritesheetUrl?: string }) | undefined)?.lpcSpritesheetUrl;
    const lpcUrl = resolveSpriteUrl(rawLpcUrl, this.localUserId);

    this.generatePlayerTextures();

    const isTiled = scenario === "tiled";
    const isImage = scenario === "image";
    let startX  = isTiled
      ? (this.tiledSpawnX || this.tiledMapW / 2)
      : isImage
        ? (raw?.backgroundImageWidth ?? WORLD_W) / 2
        : WORLD_W / 4;
    let startY  = isTiled
      ? (this.tiledSpawnY || this.tiledMapH / 2)
      : isImage
        ? (raw?.backgroundImageHeight ?? WORLD_H) / 2
        : OFFICE_H / 2;

    // Restore last position from localStorage (persisted by useWorldPresence)
    try {
      const saved = typeof localStorage !== "undefined"
        ? localStorage.getItem(`ss:pos:${this.worldConfig?.stationId ?? ""}:${this.localUserId}`)
        : null;
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0) {
          startX = x;
          startY = y;
        }
      }
    } catch { /* ignore */ }

    // ── Pipoya/LPC mode: animated sprite (default) ────────────────
    this.loadLpcSpritesheet(lpcUrl, startX, startY);

    this.playerLabel = this.add.text(startX, startY - 32, "Você", {
      fontSize: "10px", color: "#c4b5fd",
      backgroundColor: "#00000099", padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(21);

    const boundsW = isTiled
      ? this.tiledMapW
      : isImage
        ? raw?.backgroundImageWidth ?? WORLD_W
        : WORLD_W;
    const boundsH = isTiled
      ? this.tiledMapH
      : isImage
        ? raw?.backgroundImageHeight ?? WORLD_H
        : WORLD_H;
    this.cameras.main.setBounds(0, 0, boundsW, boundsH);
    this.physics.world.setBounds(0, 0, boundsW, boundsH);
    // Aplica zoom passando pelo clamp dinâmico (evita viewport maior que mapa
    // → fundo preto). Se o viewport for maior que o mapa, force o mínimo.
    this.setZoom(this.currentZoom);

    // Cenário "image" → auto-fit pra mostrar a imagem inteira na tela.
    // Centro da câmera no centro da imagem (player ainda spawna em 1/2,1/2).
    if (isImage) {
      const zx = this.cameras.main.width  / boundsW;
      const zy = this.cameras.main.height / boundsH;
      const fit = Math.min(zx, zy) * 0.95;
      this.setZoom(fit);
      this.cameras.main.centerOn(boundsW / 2, boundsH / 2);
    }

    // Re-clamp do zoom em resize da janela: viewport muda, min dinâmico muda.
    const onResize = () => {
      if (!this.cameras?.main) return;
      this.setZoom(this.currentZoom);
    };
    this.scale.on("resize", onResize);
    this.events.once("shutdown", () => {
      this.scale.off("resize", onResize);
    });
    // startFollow is called inside loadLpcSpritesheet → setupSprite once the sprite is created

    // ── Mouse wheel + trackpad zoom/pan ──────────────────────────────────
    // Regras:
    //   ctrlKey=true  → pinch (macOS) ou Ctrl+scroll → zoom (em qualquer lugar)
    //   ctrlKey=false + editorActive → dois dedos trackpad → PAN X+Y
    //     ↳ exceto se o cursor estiver dentro de um elemento scrollável do painel
    //   ctrlKey=false + !editorActive → só sobre o canvas → zoom vertical
    const canvasEl = this.game.canvas;

    /** Verifica se um elemento é (ou está dentro de) um scroll container que
     *  tem conteúdo a rolar — nesse caso deixamos o scroll nativo acontecer. */
    const insideScrollable = (el: Element | null): boolean => {
      let cur = el;
      while (cur && cur !== document.documentElement) {
        const s = window.getComputedStyle(cur);
        const ovY = s.overflowY;
        const ovX = s.overflowX;
        if (
          ((ovY === "auto" || ovY === "scroll") && cur.scrollHeight > cur.clientHeight + 2) ||
          ((ovX === "auto" || ovX === "scroll") && cur.scrollWidth  > cur.clientWidth  + 2)
        ) return true;
        cur = cur.parentElement;
      }
      return false;
    };

    const onWheel = (ev: WheelEvent) => {
      // Scene pode estar em processo de destroy (cameras=undefined). Sair
      // silenciosamente em vez de jogar TypeError em loop, o que polui o
      // console e pode interferir em handlers React de overlays acima.
      if (!this.cameras?.main) return;

      const target = ev.target as Element | null;
      const overCanvas = target === canvasEl
        || (canvasEl.parentElement?.contains(target) ?? false)
        || (target instanceof Element && target.closest("#phaser-container") !== null);

      // ── Editor aberto: intercepta gestos de QUALQUER lugar da tela ──
      if (this.editorActive) {
        // Pinça (macOS ctrlKey=true) → zoom sempre, sem importar onde o cursor está
        if (ev.ctrlKey) {
          ev.preventDefault();
          this.applyZoom(-ev.deltaY * 0.015);
          return;
        }

        // Dois dedos → PAN
        // Mas se o cursor está dentro de um scroll container real (lista do painel)
        // deixamos o scroll nativo acontecer
        if (!overCanvas && insideScrollable(target)) return;

        ev.preventDefault();
        const cam = this.cameras.main;
        cam.scrollX += ev.deltaX / cam.zoom;
        cam.scrollY += ev.deltaY / cam.zoom;
        return;
      }

      // ── Editor fechado: só age quando cursor está sobre o canvas ──
      if (!overCanvas) return;
      ev.preventDefault();

      // Pinça (ctrlKey=true no macOS) → zoom
      if (ev.ctrlKey) {
        this.applyZoom(-ev.deltaY * 0.015);
        return;
      }

      // Scroll normal → zoom vertical
      this.applyZoom(-ev.deltaY * 0.0025);
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    this.events.once("shutdown", () =>
      window.removeEventListener("wheel", onWheel, { capture: true }),
    );

    // ── Touch pinch-to-zoom ───────────────────────────────────────
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (this.pinchDist !== null) {
          const delta = dist - this.pinchDist;
          this.applyZoom(delta * 0.005);
        }
        this.pinchDist = dist;
      } else {
        this.pinchDist = null;
      }
      void ptr;
    });

    // ── Keyboard zoom  +  /  - ────────────────────────────────────
    this.input.keyboard!.on("keydown-PLUS",  () => this.applyZoom(this.ZOOM_STEP));
    this.input.keyboard!.on("keydown-MINUS", () => this.applyZoom(-this.ZOOM_STEP));
    this.input.keyboard!.on("keydown-NUMPAD_ADD",      () => this.applyZoom(this.ZOOM_STEP));
    this.input.keyboard!.on("keydown-NUMPAD_SUBTRACT", () => this.applyZoom(-this.ZOOM_STEP));

    // ── Debug toggle: Ctrl+Shift+D mostra os bodies de colisão ────
    // Útil pra diagnosticar paredes que "não colidem".
    this.input.keyboard!.on("keydown-D", (ev: KeyboardEvent) => {
      if (!ev.ctrlKey || !ev.shiftKey) return;
      const world = this.physics.world;
      world.drawDebug = !world.drawDebug;
      if (world.drawDebug) {
        if (!world.debugGraphic) world.createDebugGraphic();
        world.debugGraphic.setDepth(999);
      } else {
        world.debugGraphic?.clear();
      }
      window.dispatchEvent(new CustomEvent("space-station:physics-debug", {
        detail: { enabled: world.drawDebug },
      }));
    });

    // ── External events from React buttons ───────────────────────
    const onZoomIn  = () => this.applyZoom(this.ZOOM_STEP);
    const onZoomOut = () => this.applyZoom(-this.ZOOM_STEP);
    const onZoomReset = () => this.setZoom(1.6);
    /** Live preview do tamanho do avatar — disparado pelo WokaCustomizer. */
    const onAvatarScale = (e: Event) => {
      const { scale } = (e as CustomEvent).detail as { scale: number };
      this.applyAvatarScale(scale);
    };
    window.addEventListener("space-station:zoom-in",      onZoomIn);
    window.addEventListener("space-station:zoom-out",     onZoomOut);
    window.addEventListener("space-station:zoom-reset",   onZoomReset);
    window.addEventListener("space-station:avatar-scale", onAvatarScale);
    this.events.once("shutdown", () => {
      window.removeEventListener("space-station:zoom-in",      onZoomIn);
      window.removeEventListener("space-station:zoom-out",     onZoomOut);
      window.removeEventListener("space-station:zoom-reset",   onZoomReset);
      window.removeEventListener("space-station:avatar-scale", onAvatarScale);
    });

    // ── Snapshot do canvas via API nativa do Phaser (resolve bug WebGL/toDataURL) ──
    // O canvas Phaser usa WebGL sem preserveDrawingBuffer:true → toDataURL() retorna preto.
    // game.renderer.snapshot() faz a captura corretamente do framebuffer.
    const onCaptureSnapshot = () => {
      try {
        this.game.renderer.snapshot((img) => {
          if (!(img instanceof HTMLImageElement)) return;
          // Downscale para 480×300 via canvas 2D
          const out = document.createElement("canvas");
          out.width = 480;
          out.height = 300;
          const ctx = out.getContext("2d");
          if (!ctx) return;
          // Aguarda o load da imagem (snapshot retorna image com src=dataURL)
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, 480, 300);
            window.dispatchEvent(new CustomEvent("space-station:snapshot-result", {
              detail: { dataUrl: out.toDataURL("image/png") },
            }));
          } else {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, 480, 300);
              window.dispatchEvent(new CustomEvent("space-station:snapshot-result", {
                detail: { dataUrl: out.toDataURL("image/png") },
              }));
            };
          }
        });
      } catch (err) {
        console.error("[WorldScene] snapshot error:", err);
        window.dispatchEvent(new CustomEvent("space-station:snapshot-result", {
          detail: { dataUrl: null },
        }));
      }
    };
    window.addEventListener("space-station:capture-snapshot", onCaptureSnapshot);
    this.events.once("shutdown", () => {
      window.removeEventListener("space-station:capture-snapshot", onCaptureSnapshot);
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    // Atalhos WASD — somam com as setas, ambos funcionam ao mesmo tempo.
    // Usar a forma por string ("W,A,S,D") evita depender de `Phaser.Input.
    // Keyboard.KeyCodes` no escopo global (que veio undefined no bundle aqui
    // e fazia o create() lançar antes da scene desenhar — tela toda preta).
    const wasdRaw = this.input.keyboard!.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    this.wasd = {
      up:    wasdRaw.W,
      down:  wasdRaw.S,
      left:  wasdRaw.A,
      right: wasdRaw.D,
    };
    // createCursorKeys() captura SPACE internamente e chama preventDefault().
    // disableGlobalCapture() garante que nenhum input HTML perca o espaço.
    this.input.keyboard!.disableGlobalCapture();

    // ── Destravar teclas quando o foco sai (avatar "andando sozinho") ─────
    // Quando user abre um dropdown/input do editor enquanto segura uma seta,
    // o keyup vai pro DOM e nunca chega no Phaser → tecla fica "isDown=true"
    // pra sempre e o avatar anda pra um lado sem parar. Reseta no blur e
    // quando a aba sai de foco.
    const resetKeys = () => {
      try {
        this.input.keyboard?.resetKeys();
        const body = (this.lpcSprite ?? this.player)?.body as
          | Phaser.Physics.Arcade.Body
          | undefined;
        body?.setVelocity(0, 0);
      } catch {
        /* ignora se scene em destroy */
      }
    };
    window.addEventListener("blur", resetKeys);
    const onVisibility = () => {
      if (document.hidden) resetKeys();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Também reseta quando foco entra em qualquer input/select/textarea —
    // evita tecla travada quando user abre dropdown do editor segurando seta.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      ) {
        resetKeys();
      }
    };
    window.addEventListener("focusin", onFocusIn, true);

    this.events.once("shutdown", () => {
      window.removeEventListener("blur", resetKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focusin", onFocusIn, true);
    });

    this.createGalaxyPortal();

    // ── Remote player events (dispatched by useWorldPresence hook) ──
    const onJoin  = (e: Event) => this.onRemoteJoin((e as CustomEvent).detail  as { userId: string; x: number; y: number; name: string; spriteUrl?: string });
    const onMove  = (e: Event) => this.onRemoteMove((e as CustomEvent).detail  as { userId: string; x: number; y: number });
    const onLeave = (e: Event) => this.onRemoteLeave((e as CustomEvent).detail as { userId: string });
    window.addEventListener("space-station:remote-join",  onJoin);
    window.addEventListener("space-station:remote-move",  onMove);
    window.addEventListener("space-station:remote-leave", onLeave);
    this.events.once("shutdown", () => {
      window.removeEventListener("space-station:remote-join",  onJoin);
      window.removeEventListener("space-station:remote-move",  onMove);
      window.removeEventListener("space-station:remote-leave", onLeave);
    });

    // ── Teleporte local (Conectar pessoas: follow-accept) ─────────────
    const onTeleportTo = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };
      const active = this.lpcSprite ?? this.player;
      if (!active) return;
      active.setPosition(x, y);
      if (this.playerLabel) {
        this.playerLabel.setPosition(x, y - (this.lpcSprite ? 44 : 36));
      }
      // Announce new position so peers and localStorage are updated
      window.dispatchEvent(new CustomEvent("space-station:player-moved", {
        detail: { x, y },
      }));
    };
    window.addEventListener("space-station:teleport-to", onTeleportTo);
    this.events.once("shutdown", () => {
      window.removeEventListener("space-station:teleport-to", onTeleportTo);
    });

    // ── Initial render of placed objects from mapData ───────────
    const rawMap = this.worldConfig?.mapData as WorldMapData | null;
    const initialObjs = rawMap?.placedObjects ?? [];
    if (initialObjs.length > 0) {
      this.placedObjectsState = initialObjs;
      initialObjs.forEach(o => this.renderPlacedObject(o));
    }

    // ── Map Editor events ──────────────────────────────────────
    const onObjectsChanged = (e: Event) => {
      const { objects } = (e as CustomEvent).detail as { objects: PlacedMapObject[] };
      this.syncPlacedObjects(objects);
    };
    const onEditorActive = (e: Event) => {
      // Scene pode estar em destroy quando o user fecha o editor; sai cedo
      // pra evitar TypeError em chains que tocam this.cameras / this.sys.
      if (!this.cameras?.main) return;
      const { active } = (e as CustomEvent).detail as { active: boolean };
      this.editorActive = active;
      this.setupEditorDOMDrop(active);
      if (active) {
        // Para qualquer aba do editor: pausa o follow para pan manual funcionar
        this.cameras.main.stopFollow();
      } else {
        this.editorSelectedId = null;
        this.areaSelectedId   = null;
        this.placedObjectHighlights.forEach(h => h.destroy());
        this.placedObjectHighlights.clear();
        // Retoma follow do player ao fechar o editor
        if (this.lpcSprite) {
          this.cameras.main.startFollow(this.lpcSprite, true, 0.1, 0.1);
        }
      }
      // Re-render áreas para esconder/mostrar contorno conforme modo editor
      this.refreshAreaSelection();
    };
    const onRequestCenter = () => {
      if (!this.cameras?.main) return;
      const cam = this.cameras.main;
      const x = cam.worldView.x + cam.worldView.width  / 2;
      const y = cam.worldView.y + cam.worldView.height / 2;
      window.dispatchEvent(new CustomEvent("space-station:center-response", {
        detail: { x, y },
      }));
    };
    const onFocusObject = (e: Event) => {
      const { id } = (e as CustomEvent).detail as { id: string | null };
      this.editorSelectedId = id;
      this.refreshSelectionHighlights();
      if (id) {
        const spr = this.placedObjectSprites.get(id);
        if (spr && this.cameras?.main) this.cameras.main.pan(spr.x, spr.y, 350, "Sine.easeInOut", false);
      }
    };

    // Force depth direto: usado pelo toggle "À frente do avatar" pra evitar
    // race condition com syncPlacedObjects. Aplica setDepth no sprite agora.
    const onForceObjectDepth = (e: Event) => {
      const { id, depth } = (e as CustomEvent).detail as {
        id: string;
        depth: number;
      };
      const spr = this.placedObjectSprites.get(id);
      if (spr && spr.scene) {
        try {
          spr.setDepth(depth);
          // Também atualiza highlight pra continuar acima do sprite
          const hl = this.placedObjectHighlights.get(id);
          if (hl && hl.scene) hl.setDepth(depth + 0.1);
        } catch {
          // sprite pode ter sido destruído entre a captura e o setDepth
        }
      }
    };

    window.addEventListener("space-station:placed-objects",     onObjectsChanged);
    window.addEventListener("space-station:force-object-depth", onForceObjectDepth);
    window.addEventListener("space-station:map-editor-active",  onEditorActive);
    window.addEventListener("space-station:request-center",     onRequestCenter);
    window.addEventListener("space-station:focus-object",       onFocusObject);

    // ── Areas: initial render from mapData ──────────────────────
    const initialAreas = rawMap?.areas ?? [];
    if (initialAreas.length > 0) {
      this.areasState = initialAreas;
      initialAreas.forEach(a => {
        this.renderArea(a);
        this.syncAreaCollisionBody(a);
      });
    }

    // ── Areas: events from React ────────────────────────────────
    const onAreasChanged = (e: Event) => {
      const { areas } = (e as CustomEvent).detail as { areas: MapArea[] };
      this.syncAreas(areas);
    };
    const onAreaDrawMode = (e: Event) => {
      const { type } = (e as CustomEvent).detail as { type: AreaType | null };
      this.drawingAreaType = type;
      this.drawStart = null;
      if (this.drawPreview) { this.drawPreview.destroy(); this.drawPreview = null; }
      const canvas = (this.sys?.game?.canvas ?? null) as HTMLCanvasElement | null;
      if (canvas) canvas.style.cursor = type ? "crosshair" : "";
    };
    const onAreaFocus = (e: Event) => {
      const { id } = (e as CustomEvent).detail as { id: string };
      this.areaSelectedId = id;
      this.refreshAreaSelection();
      const area = this.areasState.find(a => a.id === id);
      if (area && this.cameras?.main) this.cameras.main.pan(area.x + area.w / 2, area.y + area.h / 2, 350, "Sine.easeInOut", false);
    };
    const onRoomCfg = (e: Event) => {
      const { config } = (e as CustomEvent).detail as { config: { showGrid?: boolean; gridSize?: number } };
      this.toggleEditorGrid(config.showGrid === true, config.gridSize ?? 32);
    };
    const onZoomFit = () => {
      if (!this.cameras?.main) return;
      // Fit both dimensions do MAPA atual no viewport (usa os bounds reais
      // que mudam por cenário: tiled, image, station, etc.)
      const cam = this.cameras.main;
      const bounds = cam.getBounds();
      const mapW = bounds.width  || WORLD_W;
      const mapH = bounds.height || WORLD_H;
      const zx = cam.width  / mapW;
      const zy = cam.height / mapH;
      const z  = Math.min(zx, zy) * 0.95;
      this.setZoom(Math.max(this.ZOOM_MIN, z));
      cam.centerOn(mapW / 2, mapH / 2);
    };
    const onCamPan = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };
      if (!this.cameras?.main) return;
      this.cameras.main.pan(x, y, 400, "Sine.easeInOut", false);
    };
    const onRequestCamView = () => this.emitCameraView();

    window.addEventListener("space-station:areas",             onAreasChanged);
    window.addEventListener("space-station:area-draw-mode",    onAreaDrawMode);
    window.addEventListener("space-station:area-focus",        onAreaFocus);
    window.addEventListener("space-station:room-config",       onRoomCfg);
    window.addEventListener("space-station:zoom-fit",          onZoomFit);
    window.addEventListener("space-station:camera-pan",        onCamPan);
    window.addEventListener("space-station:request-camera-view", onRequestCamView);

    // ── Pointer listeners for area-drawing rubber-band ──────────
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (!this.editorActive || !this.drawingAreaType) return;
      // Ignore if the click hit a game object (e.g. existing sprite / area hitzone)
      const overObj = this.input.manager.hitTest(ptr, this.children.list as Phaser.GameObjects.GameObject[], this.cameras.main);
      if (overObj.length > 0) return;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.drawStart = { x: wp.x, y: wp.y };
      if (this.drawPreview) this.drawPreview.destroy();
      this.drawPreview = this.add.graphics().setDepth(500);
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!this.drawStart || !this.drawPreview || !this.drawingAreaType) return;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const meta = this.getAreaMeta(this.drawingAreaType);
      const color = parseInt(meta.color.slice(1), 16);
      const x = Math.min(this.drawStart.x, wp.x);
      const y = Math.min(this.drawStart.y, wp.y);
      const w = Math.abs(wp.x - this.drawStart.x);
      const h = Math.abs(wp.y - this.drawStart.y);
      this.drawPreview.clear();
      this.drawPreview.fillStyle(color, 0.18);
      this.drawPreview.fillRect(x, y, w, h);
      this.drawPreview.lineStyle(2, color, 0.9);
      this.drawPreview.strokeRect(x, y, w, h);
    });
    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (!this.drawStart || !this.drawingAreaType) return;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const x = Math.min(this.drawStart.x, wp.x);
      const y = Math.min(this.drawStart.y, wp.y);
      const w = Math.abs(wp.x - this.drawStart.x);
      const h = Math.abs(wp.y - this.drawStart.y);
      const type = this.drawingAreaType;
      this.drawStart = null;
      if (this.drawPreview) { this.drawPreview.destroy(); this.drawPreview = null; }
      // Ignore tiny rectangles (miss-clicks)
      if (w < 16 || h < 16) return;
      window.dispatchEvent(new CustomEvent("space-station:area-drawn", {
        detail: { type, x, y, w, h },
      }));
    });

    // ── Tile Editor: events from React ─────────────────────────────
    const onTileEditorActive = (e: Event) => {
      const { active } = (e as CustomEvent).detail as { active: boolean };
      this.tileEditActive = active;
      const canvas = (this.sys?.game?.canvas ?? null) as HTMLCanvasElement | null;
      if (active) {
        this.showTileGrid();
        if (canvas) canvas.style.cursor = this.currentTileTool === "pan" ? "grab" : "crosshair";
      } else {
        this.tileGridGfx?.destroy();
        this.tileGridGfx = null;
        this.tilePainting = false;
        this.tilePanning  = false;
        this.rectStart = null;
        this.rectPreviewEnd = null;
        this.clearRectPreview();
        if (canvas) canvas.style.cursor = "";
      }
    };
    const onTileTool = (e: Event) => {
      const { tool, cell } = (e as CustomEvent).detail as {
        tool: "paint" | "erase" | "fill" | "rect" | "rect-erase" | "pan";
        cell: TileCell;
      };
      this.currentTileTool = tool;
      this.currentTileCell = cell;
      // Cancela preview retangular se o usuário mudou de ferramenta
      this.clearRectPreview();
      this.rectStart   = null;
      this.tilePainting = false;
      this.tilePanning  = false;
      // Atualiza cursor do canvas
      const canvas = (this.sys?.game?.canvas ?? null) as HTMLCanvasElement | null;
      if (canvas) canvas.style.cursor = tool === "pan" ? "grab" : "crosshair";
    };
    const onTileLayerSet = (e: Event) => {
      const { tileLayer } = (e as CustomEvent).detail as { tileLayer: TileLayer };
      this.tileLayerState = tileLayer;
      if (!this.tileFloorGfx) {
        this.tileFloorGfx   = this.add.graphics().setDepth(1);
        this.tileWallGfx    = this.add.graphics().setDepth(3);
        this.tileDecoGfx    = this.add.graphics().setDepth(15);
        this.tileOverlayGfx = this.add.graphics().setDepth(30);
      }
      this.syncTileRendering();
    };

    // ── helper: atualiza cursor do canvas de acordo com o estado ──
    const setTileCanvas = (cur: string) => {
      const canvas = (this.sys?.game?.canvas ?? null) as HTMLCanvasElement | null;
      if (canvas) canvas.style.cursor = cur;
    };

    // Tile painting + panning pointer events
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (!this.tileEditActive) return;

      // Botão do meio (scroll wheel) → pan sempre, independente de ferramenta
      const isMid = ptr.middleButtonDown();
      if (isMid || this.currentTileTool === "pan") {
        this.tilePanning = true;
        this.panLastX    = ptr.x;
        this.panLastY    = ptr.y;
        setTileCanvas("grabbing");
        return;
      }

      const tc = this.worldToTile(ptr);
      if (!tc) return;
      if (this.currentTileTool === "rect" || this.currentTileTool === "rect-erase") {
        this.rectStart = { tx: tc.tx, ty: tc.ty };
        this.rectPreviewEnd = { tx: tc.tx, ty: tc.ty };
        this.drawRectPreview();
      } else {
        this.tilePainting = true;
        this.applyTilePaint(ptr);
      }
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!this.tileEditActive) return;

      // Pan ativo — move câmera pelo delta de tela
      if (this.tilePanning) {
        const dx = ptr.x - this.panLastX;
        const dy = ptr.y - this.panLastY;
        const cam = this.cameras.main;
        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
        this.panLastX = ptr.x;
        this.panLastY = ptr.y;
        return;
      }

      if (this.rectStart) {
        const tc = this.worldToTile(ptr);
        if (!tc) return;
        this.rectPreviewEnd = { tx: tc.tx, ty: tc.ty };
        this.drawRectPreview();
      } else if (this.tilePainting) {
        this.applyTilePaint(ptr);
      }
    });
    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      // Termina pan
      if (this.tilePanning) {
        this.tilePanning = false;
        setTileCanvas(this.currentTileTool === "pan" ? "grab" : "crosshair");
        return;
      }

      if (this.rectStart) {
        const tc = this.worldToTile(ptr) ?? this.rectPreviewEnd;
        if (tc) {
          this.applyTileRect(
            this.rectStart.tx, this.rectStart.ty, tc.tx, tc.ty,
            this.currentTileTool === "rect-erase",
          );
        }
        this.rectStart = null;
        this.rectPreviewEnd = null;
        this.clearRectPreview();
      }
      this.tilePainting = false;
    });

    window.addEventListener("space-station:tile-editor-active", onTileEditorActive);
    window.addEventListener("space-station:tile-tool",          onTileTool);
    window.addEventListener("space-station:tile-layer",         onTileLayerSet);

    this.events.once("shutdown", () => {
      window.removeEventListener("space-station:placed-objects",     onObjectsChanged);
      window.removeEventListener("space-station:map-editor-active",  onEditorActive);
      window.removeEventListener("space-station:request-center",     onRequestCenter);
      window.removeEventListener("space-station:focus-object",       onFocusObject);
      window.removeEventListener("space-station:force-object-depth", onForceObjectDepth);
      window.removeEventListener("space-station:areas",              onAreasChanged);
      window.removeEventListener("space-station:area-draw-mode",     onAreaDrawMode);
      window.removeEventListener("space-station:area-focus",         onAreaFocus);
      window.removeEventListener("space-station:room-config",        onRoomCfg);
      window.removeEventListener("space-station:zoom-fit",           onZoomFit);
      window.removeEventListener("space-station:camera-pan",         onCamPan);
      window.removeEventListener("space-station:request-camera-view",onRequestCamView);
      window.removeEventListener("space-station:tile-editor-active", onTileEditorActive);
      window.removeEventListener("space-station:tile-tool",          onTileTool);
      window.removeEventListener("space-station:tile-layer",         onTileLayerSet);
      if (this._tileSyncTimer) clearTimeout(this._tileSyncTimer);
      this.setupEditorDOMDrop(false);
    });
  }

  /* ─── Areas: render / sync / select ──────────────────────────── */
  private getAreaMeta(this: Phaser.Scene & WorldScene, type: AreaType) {
    // Fallback se o tipo da área não existir mais no enum (ex: tipo
    // removido como `mood`). Sem isso, areas legadas crashavam o render
    // todo da scene → station ficava preta.
    return (
      AREA_TYPE_META[type] ?? {
        label: type as string,
        emoji: "🏷️",
        color: "#94a3b8",
        description: "",
      }
    );
  }

  private renderArea(this: Phaser.Scene & WorldScene, area: MapArea) {
    const meta = this.getAreaMeta(area.type);
    const color = parseInt((area.color ?? meta.color).slice(1), 16);

    const g = this.add.graphics().setDepth(100);
    this.redrawArea(g, area, color, this.areaSelectedId === area.id);
    this.areaGraphics.set(area.id, g);

    const label = this.add.text(area.x + 6, area.y + 4, `${meta.emoji} ${area.name}`, {
      fontSize: "10px", color: "#ffffff",
      backgroundColor: "#00000099", padding: { x: 4, y: 2 },
    }).setDepth(101);
    if (area.type === "collision") label.setVisible(false);
    this.areaLabels.set(area.id, label);

    this.renderAreaHitzone(area);
  }

  private renderAreaHitzone(this: Phaser.Scene & WorldScene, area: MapArea) {
    const meta = this.getAreaMeta(area.type);
    const color = parseInt((area.color ?? meta.color).slice(1), 16);
    const hit = this.add.rectangle(area.x + area.w / 2, area.y + area.h / 2, area.w, area.h, 0xffffff, 0)
      .setDepth(99)
      .setInteractive({ useHandCursor: true, draggable: true })
      .setData("areaId", area.id);
    hit.on("pointerdown", () => {
      if (!this.editorActive || this.drawingAreaType) return;
      this.areaSelectedId = area.id;
      this.refreshAreaSelection();
      window.dispatchEvent(new CustomEvent("space-station:area-selected", { detail: { id: area.id } }));
    });
    hit.on("drag", (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      if (!this.editorActive) return;
      hit.setPosition(dx, dy);
      const a = this.areasState.find(x => x.id === area.id);
      if (!a) return;
      const newX = dx - a.w / 2;
      const newY = dy - a.h / 2;
      const grp = this.areaGraphics.get(area.id);
      const lbl = this.areaLabels.get(area.id);
      if (grp) this.redrawArea(grp, { ...a, x: newX, y: newY }, color, this.areaSelectedId === area.id);
      if (lbl) lbl.setPosition(newX + 6, newY + 4);
    });
    hit.on("dragend", () => {
      if (!this.editorActive) return;
      const newX = hit.x - area.w / 2;
      const newY = hit.y - area.h / 2;
      window.dispatchEvent(new CustomEvent("space-station:area-moved", {
        detail: { id: area.id, x: newX, y: newY },
      }));
    });
    this.areaHitzones.set(area.id, hit);
  }

  private redrawArea(g: Phaser.GameObjects.Graphics, area: MapArea, color: number, selected: boolean) {
    g.clear();
    // Áreas só ficam visíveis quando explicitamente selecionadas na Ferramenta de Áreas.
    // Mesmo dentro do editor permanecem invisíveis até o usuário escolher uma na lista.
    if (!selected) return;
    g.fillStyle(color, 0.16);
    g.fillRect(area.x, area.y, area.w, area.h);
    g.lineStyle(selected ? 3 : 2, color, selected ? 1 : 0.7);
    g.strokeRect(area.x, area.y, area.w, area.h);
    if (selected) {
      g.lineStyle(1, 0xffffff, 0.6);
      g.strokeRect(area.x + 4, area.y + 4, area.w - 8, area.h - 8);
    }
  }

  private syncAreas(this: Phaser.Scene & WorldScene, next: MapArea[]) {
    if (!this.scene || !this.add) return;
    const nextIds = new Set(next.map(a => a.id));
    // remove
    this.areaGraphics.forEach((g, id) => {
      if (!nextIds.has(id)) {
        g.destroy();
        this.areaLabels.get(id)?.destroy();
        this.areaHitzones.get(id)?.destroy();
        this.areaGraphics.delete(id);
        this.areaLabels.delete(id);
        this.areaHitzones.delete(id);
      }
    });
    // remove orphan collision bodies
    this.areaCollisionBodies.forEach((b, id) => {
      if (!nextIds.has(id)) { b.destroy(); this.areaCollisionBodies.delete(id); }
    });
    // sync collision bodies (cria/atualiza/remove conforme type)
    next.forEach(a => this.syncAreaCollisionBody(a));
    // add / update
    next.forEach(a => {
      const meta = this.getAreaMeta(a.type);
      const color = parseInt((a.color ?? meta.color).slice(1), 16);
      const existing = this.areaGraphics.get(a.id);
      if (existing) {
        this.redrawArea(existing, a, color, this.areaSelectedId === a.id);
        const lbl = this.areaLabels.get(a.id);
        if (lbl) { lbl.setText(`${meta.emoji} ${a.name}`); lbl.setPosition(a.x + 6, a.y + 4); }
        const hit = this.areaHitzones.get(a.id);
        // If dimensions changed, recreate the interactive hitzone (avoids reaching into Phaser internals)
        if (hit) {
          const sizeChanged = hit.width !== a.w || hit.height !== a.h;
          if (sizeChanged) {
            hit.destroy();
            this.areaHitzones.delete(a.id);
            this.renderAreaHitzone(a);
          } else {
            hit.setPosition(a.x + a.w / 2, a.y + a.h / 2);
          }
        }
      } else {
        this.renderArea(a);
      }
    });
    this.areasState = next;
  }

  /**
   * Cria/atualiza/remove o corpo estático de colisão de uma área conforme o tipo.
   * Áreas com type === "collision" geram um body invisível no grupo this.walls.
   */
  private syncAreaCollisionBody(this: Phaser.Scene & WorldScene, area: MapArea) {
    const existing = this.areaCollisionBodies.get(area.id);
    if (area.type !== "collision") {
      if (existing) {
        existing.destroy();
        this.areaCollisionBodies.delete(area.id);
      }
      return;
    }
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h / 2;
    const w  = Math.max(area.w, 4);
    const h  = Math.max(area.h, 4);

    // Defensive: scene em destroy ou textura __blank__ perdida →
    // setDisplaySize joga TypeError lendo `texture.sourceSize`.
    // Se algo está estranho, descarta e recria.
    const isStale =
      !existing ||
      !existing.scene ||
      !existing.texture ||
      !this.textures.exists("__blank__") ||
      // body ausente: aconteceu se destroy parcial ocorreu
      !existing.body;

    if (existing && !isStale) {
      try {
        existing.setPosition(cx, cy).setDisplaySize(w, h);
        const eb = existing.body as Phaser.Physics.Arcade.StaticBody;
        eb.setSize(w, h, true);
        eb.updateFromGameObject();
        return;
      } catch (err) {
        console.warn("[syncAreaCollisionBody] update fail, recriando:", err);
        try { existing.destroy(); } catch { /* ignore */ }
        this.areaCollisionBodies.delete(area.id);
      }
    } else if (existing && isStale) {
      try { existing.destroy(); } catch { /* ignore */ }
      this.areaCollisionBodies.delete(area.id);
    }

    // Recria do zero
    if (!this.textures.exists("__blank__")) {
      // textura base perdida — não dá pra criar agora; espera próxima sync
      return;
    }
    const img = this.walls.create(cx, cy, "__blank__") as Phaser.Physics.Arcade.Image;
    img.setDisplaySize(w, h).setVisible(false).setDepth(0);
    const sBody = img.body as Phaser.Physics.Arcade.StaticBody;
    sBody.setSize(w, h, true);
    sBody.updateFromGameObject();
    this.areaCollisionBodies.set(area.id, img);
  }

  private refreshAreaSelection(this: Phaser.Scene & WorldScene) {
    this.areasState.forEach(a => {
      const meta = this.getAreaMeta(a.type);
      const color = parseInt((a.color ?? meta.color).slice(1), 16);
      const g = this.areaGraphics.get(a.id);
      if (g) this.redrawArea(g, a, color, this.areaSelectedId === a.id);
      const lbl = this.areaLabels.get(a.id);
      if (lbl) lbl.setVisible(this.areaSelectedId === a.id);
    });
  }

  private emitCameraView(this: Phaser.Scene & WorldScene) {
    const cam = this.cameras.main;
    window.dispatchEvent(new CustomEvent("space-station:camera-view", {
      detail: {
        x: cam.worldView.x, y: cam.worldView.y,
        w: cam.worldView.width, h: cam.worldView.height,
      },
    }));
  }

  // Optional grid overlay used when room-config.showGrid is enabled
  private editorGrid: Phaser.GameObjects.Graphics | null = null;
  private toggleEditorGrid(this: Phaser.Scene & WorldScene, show: boolean, size: number) {
    if (this.editorGrid) { this.editorGrid.destroy(); this.editorGrid = null; }
    if (!show || size <= 0) return;
    const g = this.add.graphics().setDepth(90);
    g.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x <= WORLD_W; x += size) { g.moveTo(x, 0); g.lineTo(x, WORLD_H); }
    for (let y = 0; y <= WORLD_H; y += size) { g.moveTo(0, y); g.lineTo(WORLD_W, y); }
    g.strokePath();
    this.editorGrid = g;
  }

  // ─── Map Editor: rendering & interaction ───────────────────────

  private renderPlacedObject(this: Phaser.Scene & WorldScene, obj: PlacedMapObject) {
    // Defensive: scene pode estar em destroy quando o React dispara eventos.
    if (!this.scene || !this.add || !this.load || !this.textures) return;
    // Cada objeto usa uma key baseada na URL para evitar reload de imagens idênticas
    const key = `pl-img-${hashString(obj.url)}`;

    const finalize = () => {
      // Evita duplicar quando a imagem termina de carregar
      if (this.placedObjectSprites.has(obj.id)) return;
      // Resolve o objeto atual a partir do state (pode ter mudado entre o
      // start do load async e o finalize — ex: user toggle "À frente do
      // avatar" enquanto imagem carregava → depth atualizado).
      const current =
        this.placedObjectsState.find((o) => o.id === obj.id) ?? obj;
      const img = this.add.image(current.x, current.y, key)
        .setDepth(current.depth ?? 5)
        .setScale(current.scale ?? 1)
        .setRotation(((current.rotation ?? 0) * Math.PI) / 180)
        .setInteractive({ useHandCursor: true, draggable: true })
        .setData("objId", obj.id);

      img.on("pointerdown", () => {
        if (!this.editorActive) return;
        this.editorSelectedId = obj.id;
        window.dispatchEvent(new CustomEvent("space-station:object-selected", {
          detail: { id: obj.id },
        }));
        this.refreshSelectionHighlights();
      });

      img.on("drag", (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        if (!this.editorActive) return;
        img.setPosition(dx, dy);
        const hl = this.placedObjectHighlights.get(obj.id);
        if (hl) hl.setPosition(dx, dy);
      });

      img.on("dragend", () => {
        if (!this.editorActive) return;
        window.dispatchEvent(new CustomEvent("space-station:object-moved", {
          detail: { id: obj.id, x: img.x, y: img.y },
        }));
      });

      this.placedObjectSprites.set(obj.id, img);

      // ── Colisão: se solid, cria corpo estático no grupo de paredes ──
      if (current.solid) {
        this.addPlacedObjectBody(obj.id, img.x, img.y, img.displayWidth, img.displayHeight);
      }

      if (this.editorSelectedId === obj.id) this.refreshSelectionHighlights();
    };

    if (this.textures.exists(key)) {
      finalize();
    } else {
      // Data URIs podem ser carregadas diretamente, HTTP/paths também
      this.load.image(key, obj.url);
      this.load.once(`filecomplete-image-${key}`, finalize);
      this.load.once("loaderror", (file: Phaser.Loader.File) => {
        if (file.key === key) console.warn("[WorldScene] failed to load placed object:", obj.url);
      });
      this.load.start();
    }
  }

  private syncPlacedObjects(this: Phaser.Scene & WorldScene, next: PlacedMapObject[]) {
    if (!this.scene || !this.add) return;
    const nextIds = new Set(next.map(o => o.id));

    // Remove objetos que não estão mais na lista
    this.placedObjectSprites.forEach((spr, id) => {
      if (!nextIds.has(id)) {
        spr.destroy();
        this.placedObjectSprites.delete(id);
        const hl = this.placedObjectHighlights.get(id);
        if (hl) { hl.destroy(); this.placedObjectHighlights.delete(id); }
        // Remove corpo de física se existia
        const body = this.placedObjectBodies.get(id);
        if (body) { body.destroy(); this.placedObjectBodies.delete(id); }
      }
    });

    // Atualiza ou cria
    next.forEach(obj => {
      const existing = this.placedObjectSprites.get(obj.id);
      if (existing) {
        existing.setPosition(obj.x, obj.y);
        existing.setScale(obj.scale ?? 1);
        existing.setRotation(((obj.rotation ?? 0) * Math.PI) / 180);
        existing.setDepth(obj.depth ?? 5);
        const hl = this.placedObjectHighlights.get(obj.id);
        if (hl) hl.setPosition(obj.x, obj.y);

        // ── Reconcilia corpo de física com flag solid ──────────────
        const existingBody = this.placedObjectBodies.get(obj.id);
        if (obj.solid) {
          if (existingBody) {
            // Atualiza posição/tamanho do corpo estático
            const bw = Math.max(existing.displayWidth,  8);
            const bh = Math.max(existing.displayHeight, 8);
            existingBody.setPosition(obj.x, obj.y).setDisplaySize(bw, bh);
            const sBody = existingBody.body as Phaser.Physics.Arcade.StaticBody;
            sBody.setSize(bw, bh, true);
            sBody.updateFromGameObject();
          } else {
            // Acabou de ser marcado como solid
            this.addPlacedObjectBody(obj.id, obj.x, obj.y, existing.displayWidth, existing.displayHeight);
          }
        } else if (existingBody) {
          // Foi desmarcado como solid
          existingBody.destroy();
          this.placedObjectBodies.delete(obj.id);
        }
      } else {
        this.renderPlacedObject(obj);
      }
    });

    this.placedObjectsState = next;
    this.refreshSelectionHighlights();
  }

  /**
   * Cria um corpo estático invisível no grupo this.walls para o objeto.
   * O jogador colide com ele exatamente como colide com as paredes do mapa.
   */
  private addPlacedObjectBody(
    this: Phaser.Scene & WorldScene,
    id: string,
    x: number, y: number,
    w: number, h: number,
  ) {
    // Garante dimensões mínimas razoáveis
    const bw = Math.max(w, 8);
    const bh = Math.max(h, 8);
    const img = this.walls.create(x, y, "__blank__") as Phaser.Physics.Arcade.Image;
    img.setDisplaySize(bw, bh).setVisible(false).setDepth(0);
    const sBody = img.body as Phaser.Physics.Arcade.StaticBody;
    sBody.setSize(bw, bh, true);
    sBody.updateFromGameObject();
    this.placedObjectBodies.set(id, img);
  }

  private refreshSelectionHighlights(this: Phaser.Scene & WorldScene) {
    if (!this.scene || !this.add) return;
    this.placedObjectHighlights.forEach(h => {
      try { h.destroy(); } catch { /* ignore */ }
    });
    this.placedObjectHighlights.clear();
    this.clearResizeHandles();
    if (!this.editorSelectedId) return;
    const spr = this.placedObjectSprites.get(this.editorSelectedId);
    if (!spr || !spr.scene) return;
    const w = spr.displayWidth;
    const h = spr.displayHeight;
    const g = this.add.graphics().setDepth((spr.depth ?? 5) + 0.1);
    g.lineStyle(2, 0x6366f1, 0.9);
    g.strokeRect(-w/2 - 3, -h/2 - 3, w + 6, h + 6);
    g.lineStyle(1, 0xa5b4fc, 0.5);
    g.strokeRect(-w/2 - 6, -h/2 - 6, w + 12, h + 12);
    g.setPosition(spr.x, spr.y);
    this.placedObjectHighlights.set(this.editorSelectedId, g);
    if (this.editorActive) this.showResizeHandles(spr);
  }

  // ─── Tile Layer: render ────────────────────────────────────────

  /**
   * Resolve a camada efetiva de um tile com base em sua textura.
   * Texturas `wall_*` são SEMPRE sólidas (wall + colisão), mesmo que o
   * dado persistido venha com layer inconsistente. Isso garante que tiles
   * de parede dentro de ambientes prontos também bloqueiem o jogador.
   */
  private resolveTileLayer(
    texture: string | undefined,
    fallback: "floor" | "wall" | "decoration" | "overlay",
  ): "floor" | "wall" | "decoration" | "overlay" {
    // Quando o user explicitamente setou "overlay" (toggle "À frente do
    // avatar"), respeita — mesmo pra texturas `wall_*` (telhado/parede
    // de cima vista de cima sem colisão).
    if (fallback === "overlay") return "overlay";
    if (typeof texture === "string") {
      if (texture.startsWith("wall_"))  return "wall";
      if (texture.startsWith("floor_")) return "floor";
      if (texture.startsWith("deco_"))  return "decoration";
    }
    return fallback;
  }

  private syncTileRendering(this: Phaser.Scene & WorldScene) {
    const tl = this.tileLayerState;
    if (!this.tileFloorGfx || !this.tileWallGfx || !this.tileDecoGfx) return;

    this.tileFloorGfx.clear();
    this.tileWallGfx.clear();
    this.tileDecoGfx.clear();
    this.tileOverlayGfx?.clear();

    // Destroy old wall tile physics bodies
    this.tileWallBodies.forEach(b => b.destroy());
    this.tileWallBodies.clear();

    if (!tl) return;

    for (const [key, cell] of Object.entries(tl.cells)) {
      const [tx, ty] = key.split(",").map(Number);
      const px = tx * T;
      const py = ty * T;

      // Resolve pela textura — wall_* sempre vira wall com colisão,
      // espelhando a regra para tiles vindos de ambientes prontos.
      const effectiveLayer = this.resolveTileLayer(cell.texture, cell.layer);

      if (effectiveLayer === "floor") {
        this.drawTilePattern(this.tileFloorGfx, cell, px, py);
      } else if (effectiveLayer === "wall") {
        this.drawTilePattern(this.tileWallGfx, cell, px, py);
        // ── Physics body for wall collision ─────────────────────
        // Cria um StaticBody 32×32 centrado no tile.
        // Usa setSize explícito no StaticBody em vez de só refreshBody()
        // para garantir que o body fique 32×32 mesmo se a textura base
        // (__blank__ 4×4) confundir o refreshBody.
        const img = this.walls.create(px + T / 2, py + T / 2, "__blank__") as Phaser.Physics.Arcade.Image;
        img.setDisplaySize(T, T).setVisible(false).setDepth(0);
        const sBody = img.body as Phaser.Physics.Arcade.StaticBody;
        sBody.setSize(T, T, true);   // true = re-center on gameObject
        sBody.updateFromGameObject();
        this.tileWallBodies.set(key, img);
      } else if (effectiveLayer === "overlay" && this.tileOverlayGfx) {
        // Camada acima do avatar (telhado, copa, vidraça etc.) — sem
        // colisão, só renderização com depth 30.
        this.drawTilePattern(this.tileOverlayGfx, cell, px, py);
      } else {
        this.drawTilePattern(this.tileDecoGfx, cell, px, py);
      }
    }
  }

  private drawTilePattern(
    this: Phaser.Scene & WorldScene,
    gfx: Phaser.GameObjects.Graphics,
    cell: TileCell,
    px: number,
    py: number,
  ) {
    const color = cell.color ? parseInt(cell.color.slice(1), 16) : 0xa0783c;
    const darken = (c: number, f: number) => {
      const r = Math.floor(((c >> 16) & 0xff) * f);
      const g = Math.floor(((c >> 8)  & 0xff) * f);
      const b = Math.floor((c & 0xff) * f);
      return (r << 16) | (g << 8) | b;
    };
    const lighten = (c: number, f: number) => {
      const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * f));
      const g = Math.min(255, Math.floor(((c >> 8)  & 0xff) * f));
      const b = Math.min(255, Math.floor((c & 0xff) * f));
      return (r << 16) | (g << 8) | b;
    };

    gfx.fillStyle(color, 1);
    gfx.fillRect(px, py, T, T);

    switch (cell.texture as TileTextureKey) {
      /* ─── PISOS ─────────────────────────────────────── */
      case "floor_wood": {
        gfx.fillStyle(darken(color, 0.82), 1);
        for (let i = 1; i <= 3; i++) gfx.fillRect(px, py + i * 8, T, 1);
        gfx.fillStyle(darken(color, 0.9), 1);
        for (let i = 0; i < 4; i++) gfx.fillRect(px + i * 8 + 4, py + 2, 1, 4);
        break;
      }
      case "floor_plank": {
        gfx.fillStyle(darken(color, 0.75), 1);
        gfx.fillRect(px, py + 10, T, 1);
        gfx.fillRect(px, py + 21, T, 1);
        gfx.fillStyle(darken(color, 0.88), 1);
        gfx.fillRect(px + 15, py, 1, 10);
        gfx.fillRect(px + 8,  py + 11, 1, 10);
        gfx.fillRect(px + 23, py + 11, 1, 10);
        gfx.fillRect(px + 16, py + 22, 1, 10);
        break;
      }
      case "floor_parquet": {
        gfx.fillStyle(darken(color, 0.75), 1);
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if ((r + c) % 2 === 0) gfx.fillRect(px + c * 8, py + r * 8 + 7, 8, 1);
            else                   gfx.fillRect(px + c * 8 + 7, py + r * 8, 1, 8);
          }
        }
        break;
      }
      case "floor_stone": {
        gfx.fillStyle(darken(color, 0.72), 1);
        const seed = (px * 31 + py * 17) % 255;
        const dots: [number, number][] = [
          [seed % T, (seed * 3) % T],
          [(seed * 7) % T, (seed * 11) % T],
          [(seed * 13) % T, (seed * 5) % T],
          [(seed * 19) % T, (seed * 23) % T],
          [(seed * 29) % T, (seed * 31) % T],
          [(seed * 37) % T, (seed * 41) % T],
        ];
        for (const [dx, dy] of dots) {
          gfx.fillRect(px + (dx % (T - 2)), py + (dy % (T - 2)), 2, 2);
        }
        break;
      }
      case "floor_cobble": {
        gfx.lineStyle(1, darken(color, 0.4), 1);
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            gfx.strokeRect(px + c * 8, py + r * 8, 8, 8);
          }
        }
        gfx.fillStyle(lighten(color, 1.15), 1);
        gfx.fillRect(px + 2, py + 2, 1, 1);
        gfx.fillRect(px + 18, py + 10, 1, 1);
        gfx.fillRect(px + 26, py + 26, 1, 1);
        break;
      }
      case "floor_marble": {
        gfx.lineStyle(1, darken(color, 0.65), 1);
        gfx.beginPath();
        gfx.moveTo(px + 2, py + 6);
        gfx.lineTo(px + 10, py + 5);
        gfx.lineTo(px + 20, py + 10);
        gfx.lineTo(px + 30, py + 9);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(px + 4, py + 22);
        gfx.lineTo(px + 14, py + 26);
        gfx.lineTo(px + 22, py + 20);
        gfx.lineTo(px + 30, py + 24);
        gfx.strokePath();
        break;
      }
      case "floor_carpet": {
        gfx.fillStyle(darken(color, 0.78), 1);
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 0) gfx.fillRect(px + c * 4, py + r * 4, 2, 2);
          }
        }
        break;
      }
      case "floor_concrete": {
        gfx.fillStyle(darken(color, 0.7), 1);
        for (let i = 0; i < 8; i++) gfx.fillRect(px + 6 + i, py + 4 + i, 1, 1);
        gfx.fillStyle(darken(color, 0.85), 1);
        gfx.fillRect(px, py + 16, T, 1);
        break;
      }
      case "floor_metal": {
        gfx.fillStyle(lighten(color, 1.15), 1);
        for (let i = 1; i < 4; i++) {
          gfx.fillRect(px, py + i * 8, T, 1);
          gfx.fillRect(px + i * 8, py, 1, T);
        }
        gfx.fillStyle(darken(color, 0.75), 1);
        for (const [dx, dy] of [[2,2],[T-4,2],[2,T-4],[T-4,T-4]] as [number,number][]) {
          gfx.fillRect(px + dx, py + dy, 2, 2);
        }
        break;
      }
      case "floor_tech": {
        gfx.lineStyle(1, lighten(color, 2.5), 1);
        gfx.strokeRect(px + 4, py + 4, 24, 24);
        gfx.beginPath();
        gfx.moveTo(px + 4, py + 16);  gfx.lineTo(px + 12, py + 16);
        gfx.moveTo(px + 20, py + 16); gfx.lineTo(px + 28, py + 16);
        gfx.moveTo(px + 16, py + 4);  gfx.lineTo(px + 16, py + 12);
        gfx.moveTo(px + 16, py + 20); gfx.lineTo(px + 16, py + 28);
        gfx.strokePath();
        gfx.fillStyle(0x00ffd0, 1);
        gfx.fillRect(px + 15, py + 15, 3, 3);
        break;
      }
      case "floor_glass": {
        gfx.fillStyle(lighten(color, 1.2), 0.4);
        gfx.fillRect(px, py, T, T);
        gfx.fillStyle(0xffffff, 0.35);
        gfx.fillRect(px + 2, py + 2, 6, 3);
        gfx.fillRect(px + 22, py + 20, 4, 2);
        break;
      }
      case "floor_tile_white":
      case "floor_tile_dark": {
        gfx.fillStyle(darken(color, 0.55), 1);
        gfx.fillRect(px, py + 15, T, 2);
        gfx.fillRect(px + 15, py, 2, T);
        break;
      }
      case "floor_checker": {
        gfx.fillStyle(0x1a1a1a, 1);
        gfx.fillRect(px, py, 16, 16);
        gfx.fillRect(px + 16, py + 16, 16, 16);
        break;
      }
      case "floor_brick": {
        gfx.fillStyle(darken(color, 0.55), 1);
        for (let row = 0; row < 4; row++) gfx.fillRect(px, py + row * 8 + 7, T, 1);
        for (let row = 0; row < 4; row++) {
          const off = row % 2 === 0 ? 0 : 16;
          for (let c2 = 0; c2 <= 32; c2 += 16) gfx.fillRect(px + c2 + off, py + row * 8, 1, 7);
        }
        break;
      }
      case "floor_hex": {
        gfx.lineStyle(1, darken(color, 0.55), 1);
        const hexH = 10, hexW = 8;
        for (let row = -1; row < 4; row++) {
          for (let col = -1; col < 5; col++) {
            const cx = col * hexW + (row % 2 ? hexW / 2 : 0);
            const cy = row * (hexH - 2);
            gfx.beginPath();
            gfx.moveTo(px + cx,         py + cy + hexH / 2);
            gfx.lineTo(px + cx + hexW/2, py + cy);
            gfx.lineTo(px + cx + hexW,   py + cy + hexH / 2);
            gfx.lineTo(px + cx + hexW,   py + cy + hexH);
            gfx.lineTo(px + cx + hexW/2, py + cy + hexH + hexH / 2);
            gfx.lineTo(px + cx,         py + cy + hexH);
            gfx.closePath();
            gfx.strokePath();
          }
        }
        break;
      }
      case "floor_sand": {
        gfx.fillStyle(darken(color, 0.85), 1);
        for (let i = 0; i < 20; i++) {
          const sx = ((px * 37 + py * 13 + i * 7) % T + T) % T;
          const sy = ((px * 19 + py * 23 + i * 11) % T + T) % T;
          gfx.fillRect(px + sx, py + sy, 1, 1);
        }
        gfx.lineStyle(1, darken(color, 0.78), 1);
        gfx.beginPath();
        gfx.moveTo(px, py + 10);
        gfx.lineTo(px + 10, py + 8);
        gfx.lineTo(px + 20, py + 12);
        gfx.lineTo(px + T, py + 10);
        gfx.strokePath();
        break;
      }
      case "floor_dirt": {
        gfx.fillStyle(darken(color, 0.7), 1);
        const seed3 = ((px * 23 + py * 29) % 255 + 255) % 255;
        for (let i = 0; i < 18; i++) {
          const dx = (seed3 * (i + 3) * 7) % T;
          const dy = (seed3 * (i + 5) * 11) % T;
          gfx.fillRect(px + dx, py + dy, 1, 1);
        }
        gfx.fillStyle(lighten(color, 1.2), 1);
        gfx.fillRect(px + 8, py + 20, 2, 1);
        gfx.fillRect(px + 22, py + 6, 2, 1);
        break;
      }
      case "floor_grass": {
        gfx.fillStyle(darken(color, 0.7), 1);
        const seed4 = ((px * 13 + py * 7) % 16 + 16) % 16;
        for (let i = 0; i < 14; i++) {
          const bx = (seed4 * (i + 3) * 7) % (T - 2);
          const by = (seed4 * (i + 5) * 11) % (T - 3);
          gfx.fillRect(px + bx, py + by, 1, 3);
        }
        gfx.fillStyle(lighten(color, 1.3), 1);
        for (let i = 0; i < 6; i++) {
          const bx = (seed4 * (i + 7) * 13) % (T - 1);
          const by = (seed4 * (i + 9) * 17) % (T - 2);
          gfx.fillRect(px + bx, py + by, 1, 2);
        }
        break;
      }
      case "floor_snow": {
        gfx.fillStyle(0xb4c8e6, 0.45);
        for (const [dx, dy] of [[4,4],[20,10],[12,22],[28,18],[6,26]] as [number,number][]) {
          gfx.fillCircle(px + dx, py + dy, 3);
        }
        break;
      }
      case "floor_ice": {
        gfx.lineStyle(1, 0xffffff, 0.8);
        gfx.beginPath();
        gfx.moveTo(px + 4, py + 4);   gfx.lineTo(px + 14, py + 14);
        gfx.moveTo(px + 20, py + 6);  gfx.lineTo(px + 28, py + 18);
        gfx.moveTo(px + 8, py + 22);  gfx.lineTo(px + 22, py + 28);
        gfx.strokePath();
        gfx.fillStyle(0xffffff, 0.6);
        gfx.fillRect(px + 3, py + 3, 2, 2);
        gfx.fillRect(px + 26, py + 24, 2, 2);
        break;
      }
      case "floor_lava": {
        gfx.fillStyle(0xffb347, 1);
        for (let wx = 0; wx < T; wx++) {
          const wy = Math.round(Math.sin((wx / T) * Math.PI * 3) * 3 + 16);
          gfx.fillRect(px + wx, py + wy, 1, 1);
        }
        gfx.fillStyle(0xffe664, 0.5);
        for (const [dx, dy, r] of [[6,8,2],[22,20,3],[14,26,2]] as [number,number,number][]) {
          gfx.fillCircle(px + dx, py + dy, r);
        }
        break;
      }

      /* ─── PAREDES ───────────────────────────────────── */
      case "wall_brick": {
        gfx.fillStyle(darken(color, 0.6), 1);
        for (let row = 0; row < 4; row++) gfx.fillRect(px, py + row * 8 + 7, T, 1);
        for (let row = 0; row < 4; row++) {
          const off = row % 2 === 0 ? 0 : 14;
          gfx.fillRect(px + off, py + row * 8, 1, 7);
          gfx.fillRect(px + off + 14, py + row * 8, 1, 7);
          gfx.fillRect(px + off + 28, py + row * 8, 1, 7);
        }
        break;
      }
      case "wall_stone": {
        gfx.lineStyle(1, darken(color, 0.5), 1);
        gfx.strokeRect(px, py, 14, 11);
        gfx.strokeRect(px + 15, py, 16, 8);
        gfx.strokeRect(px + 15, py + 9, 10, 12);
        gfx.strokeRect(px + 26, py + 9, 5, 15);
        gfx.strokeRect(px, py + 12, 10, 11);
        gfx.strokeRect(px + 11, py + 12, 14, 11);
        gfx.strokeRect(px, py + 24, 15, 7);
        gfx.strokeRect(px + 16, py + 24, 15, 7);
        gfx.fillStyle(lighten(color, 1.15), 1);
        gfx.fillRect(px + 3, py + 3, 1, 1);
        gfx.fillRect(px + 20, py + 4, 1, 1);
        gfx.fillRect(px + 25, py + 28, 1, 1);
        break;
      }
      case "wall_concrete": {
        gfx.fillStyle(darken(color, 0.7), 1);
        for (let i = 0; i < 8; i++) gfx.fillRect(px + 6 + i, py + 4 + i, 1, 1);
        gfx.fillStyle(darken(color, 0.85), 1);
        gfx.fillRect(px, py + 16, T, 1);
        break;
      }
      case "wall_wood": {
        gfx.fillStyle(darken(color, 0.8), 1);
        gfx.fillRect(px, py + 10, T, 2);
        gfx.fillRect(px, py + 22, T, 2);
        gfx.fillStyle(darken(color, 0.9), 1);
        gfx.fillRect(px + 16, py, 1, 10);
        gfx.fillRect(px + 16, py + 12, 1, 10);
        gfx.fillRect(px + 16, py + 24, 1, 8);
        break;
      }
      case "wall_metal": {
        gfx.fillStyle(lighten(color, 1.25), 1);
        gfx.fillRect(px, py + 15, T, 2);
        gfx.fillStyle(darken(color, 0.65), 1);
        gfx.fillRect(px, py + 14, T, 1);
        gfx.fillRect(px, py + 17, T, 1);
        gfx.fillStyle(darken(color, 0.5), 1);
        for (const [dx, dy] of [[3,3],[T-5,3],[3,T-5],[T-5,T-5],[3,14],[T-5,14]] as [number,number][]) {
          gfx.fillCircle(px + dx, py + dy, 1.5);
        }
        break;
      }
      case "wall_glass": {
        gfx.fillStyle(lighten(color, 1.25), 0.6);
        gfx.fillRect(px, py, T, T);
        gfx.fillStyle(darken(color, 0.55), 1);
        gfx.fillRect(px, py, T, 2);
        gfx.fillRect(px, py + T - 2, T, 2);
        gfx.fillRect(px, py, 2, T);
        gfx.fillRect(px + T - 2, py, 2, T);
        gfx.fillRect(px, py + 15, T, 1);
        gfx.fillRect(px + 15, py, 1, T);
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillRect(px + 4, py + 4, 3, 8);
        gfx.fillRect(px + 20, py + 20, 3, 6);
        break;
      }
      case "wall_tech": {
        gfx.fillStyle(lighten(color, 2.8), 1);
        gfx.fillRect(px + 3, py + 6, 10, 1);
        gfx.fillRect(px + 12, py + 6, 1, 10);
        gfx.fillRect(px + 12, py + 16, 8, 1);
        gfx.fillRect(px + 20, py + 10, 1, 10);
        gfx.fillRect(px + 20, py + 20, 9, 1);
        gfx.fillStyle(0x00ffe0, 1);
        gfx.fillRect(px + 12, py + 5, 2, 2);
        gfx.fillRect(px + 19, py + 15, 2, 2);
        gfx.fillRect(px + 28, py + 19, 2, 2);
        break;
      }
      case "wall_sandstone": {
        gfx.fillStyle(darken(color, 0.7), 1);
        gfx.fillRect(px, py + 10, T, 1);
        gfx.fillRect(px, py + 21, T, 1);
        gfx.fillRect(px + 10, py, 1, 10);
        gfx.fillRect(px + 22, py + 11, 1, 10);
        gfx.fillRect(px + 10, py + 22, 1, 10);
        gfx.fillStyle(darken(color, 0.85), 1);
        for (let i = 0; i < 12; i++) {
          const sx = ((px * 37 + i * 13) % T + T) % T;
          const sy = ((py * 19 + i * 7) % T + T) % T;
          gfx.fillRect(px + sx, py + sy, 1, 1);
        }
        break;
      }
      case "wall_hedge": {
        gfx.fillStyle(darken(color, 0.7), 1);
        for (let i = 0; i < 20; i++) {
          const dx = ((px * 23 + i * 7) % T + T) % T;
          const dy = ((py * 11 + i * 13) % T + T) % T;
          gfx.fillRect(px + dx, py + dy, 2, 2);
        }
        gfx.fillStyle(lighten(color, 1.35), 1);
        for (let i = 0; i < 10; i++) {
          const dx = ((px * 29 + i * 11) % T + T) % T;
          const dy = ((py * 17 + i * 19) % T + T) % T;
          gfx.fillRect(px + dx, py + dy, 1, 2);
        }
        break;
      }
      case "wall_ice": {
        gfx.fillStyle(0xffffff, 0.5);
        gfx.fillTriangle(px, py, px + 12, py, px + 6, py + 10);
        gfx.fillTriangle(px + T, py, px + T - 10, py, px + T - 4, py + 8);
        gfx.lineStyle(1, 0xffffff, 0.7);
        gfx.beginPath();
        gfx.moveTo(px + 4, py + 15);  gfx.lineTo(px + 15, py + 22);
        gfx.moveTo(px + 20, py + 18); gfx.lineTo(px + 28, py + 28);
        gfx.strokePath();
        break;
      }
      case "wall_cave": {
        gfx.fillStyle(lighten(color, 1.6), 1);
        const seed5 = ((px * 31 + py * 19) % 255 + 255) % 255;
        for (let i = 0; i < 12; i++) {
          const dx = (seed5 * (i + 3) * 7) % T;
          const dy = (seed5 * (i + 5) * 11) % T;
          gfx.fillRect(px + dx, py + dy, 2, 2);
        }
        gfx.fillStyle(darken(color, 0.5), 1);
        for (let i = 0; i < 6; i++) {
          const dx = (seed5 * (i + 13) * 17) % (T - 3);
          const dy = (seed5 * (i + 7) * 23) % (T - 3);
          gfx.fillRect(px + dx, py + dy, 3, 3);
        }
        break;
      }

      /* ─── DECORAÇÃO ─────────────────────────────────── */
      case "deco_water": {
        gfx.fillStyle(lighten(color, 1.18), 1);
        for (let x = 0; x < T; x++) {
          const y1 = Math.round(Math.sin((x / T) * Math.PI * 2) * 2 + 10);
          const y2 = Math.round(Math.sin((x / T) * Math.PI * 2 + Math.PI) * 2 + 22);
          gfx.fillRect(px + x, py + y1, 1, 2);
          gfx.fillRect(px + x, py + y2, 1, 2);
        }
        break;
      }
      case "deco_puddle": {
        gfx.fillStyle(lighten(color, 1.15), 0.9);
        gfx.fillEllipse(px + 16, py + 18, 26, 16);
        gfx.fillStyle(0xffffff, 0.45);
        gfx.fillRect(px + 8, py + 14, 5, 1);
        gfx.fillRect(px + 20, py + 22, 3, 1);
        break;
      }
      case "deco_grass": {
        gfx.fillStyle(darken(color, 0.75), 1);
        const seed2 = (px * 13 + py * 7) % 16;
        for (let i = 0; i < 10; i++) {
          const bx = (seed2 * (i + 3) * 7) % (T - 2);
          const by = (seed2 * (i + 5) * 11) % (T - 4);
          gfx.fillRect(px + bx, py + by, 2, 4);
        }
        break;
      }
      case "deco_bushes": {
        gfx.fillStyle(lighten(color, 1.3), 1);
        for (const [dx, dy, r] of [[10,14,6],[22,10,5],[18,24,6]] as [number,number,number][]) {
          gfx.fillCircle(px + dx, py + dy, r);
        }
        gfx.fillStyle(darken(color, 0.7), 1);
        for (const [dx, dy] of [[8,16],[14,8],[24,14],[16,28]] as [number,number][]) {
          gfx.fillRect(px + dx, py + dy, 1, 1);
        }
        break;
      }
      case "deco_flowers": {
        const petals: [number, number, number][] = [
          [8, 10, 0xffc2d9], [22, 16, 0xffe081], [14, 24, 0xc3a5ff],
        ];
        for (const [px2, py2, petal] of petals) {
          gfx.fillStyle(petal, 1);
          for (const [dx, dy] of [[-3,0],[3,0],[0,-3],[0,3]] as [number,number][]) {
            gfx.fillCircle(px + px2 + dx, py + py2 + dy, 2);
          }
          gfx.fillStyle(color, 1);
          gfx.fillCircle(px + px2, py + py2, 1.5);
        }
        gfx.fillStyle(0x2f6d2c, 1);
        gfx.fillRect(px + 8,  py + 13, 1, 4);
        gfx.fillRect(px + 22, py + 19, 1, 4);
        gfx.fillRect(px + 14, py + 27, 1, 3);
        break;
      }
      case "deco_leaves": {
        const colors = [darken(color, 0.8), lighten(color, 1.2), 0x4f6b2a];
        for (let i = 0; i < 7; i++) {
          const seed = (px * 23 + py * 17 + i * 37) % 255;
          const lx = seed % (T - 4);
          const ly = (seed * 3) % (T - 4);
          gfx.fillStyle(colors[i % 3], 1);
          gfx.fillEllipse(px + lx, py + ly, 6, 4);
        }
        break;
      }
      case "deco_sand": {
        gfx.fillStyle(darken(color, 0.8), 1);
        for (let i = 0; i < 30; i++) {
          const sx = ((px * 37 + i * 7) % T + T) % T;
          const sy = ((py * 19 + i * 11) % T + T) % T;
          gfx.fillRect(px + sx, py + sy, 1, 1);
        }
        gfx.fillStyle(lighten(color, 1.2), 1);
        for (let i = 0; i < 8; i++) {
          const sx = ((px * 13 + i * 17) % T + T) % T;
          const sy = ((py * 29 + i * 23) % T + T) % T;
          gfx.fillRect(px + sx, py + sy, 1, 1);
        }
        break;
      }
      case "deco_gravel": {
        for (let i = 0; i < 14; i++) {
          const seed = (px * 31 + py * 17 + i * 41) % 255;
          const gx = seed % (T - 3);
          const gy = (seed * 3) % (T - 3);
          gfx.fillStyle(i % 2 === 0 ? darken(color, 0.65) : lighten(color, 1.3), 1);
          gfx.fillRect(px + gx, py + gy, 2, 2);
        }
        break;
      }
      case "deco_rocks": {
        gfx.fillStyle(lighten(color, 1.2), 1);
        for (const [dx, dy, w, h] of [[6,8,5,4],[20,12,6,5],[10,22,4,4],[24,24,5,3]] as [number,number,number,number][]) {
          gfx.fillRect(px + dx, py + dy, w, h);
        }
        gfx.fillStyle(darken(color, 0.55), 1);
        for (const [dx, dy] of [[11,11],[20,12],[14,25],[28,26]] as [number,number][]) {
          gfx.fillRect(px + dx, py + dy, 1, 1);
        }
        break;
      }
      case "deco_snow": {
        gfx.fillStyle(0xffffff, 1);
        for (const [dx, dy] of [[6,8],[16,4],[24,12],[10,20],[22,26],[4,26]] as [number,number][]) {
          gfx.fillCircle(px + dx, py + dy, 1.5);
          gfx.fillRect(px + dx - 2, py + dy, 4, 1);
          gfx.fillRect(px + dx, py + dy - 2, 1, 4);
        }
        break;
      }
      case "deco_lava": {
        for (const [dx, dy, r] of [[8,10,3],[22,14,4],[14,24,3]] as [number,number,number][]) {
          gfx.fillStyle(0xffdd55, 1);
          gfx.fillCircle(px + dx, py + dy, r);
          gfx.fillStyle(0xffffff, 1);
          gfx.fillCircle(px + dx - 1, py + dy - 1, 1);
        }
        break;
      }
      case "deco_fire": {
        // Chama externa laranja
        gfx.fillStyle(0xffbb33, 1);
        gfx.fillTriangle(px + 16, py + 4, px + 22, py + 16, px + 16, py + 28);
        gfx.fillTriangle(px + 16, py + 4, px + 10, py + 16, px + 16, py + 28);
        // Chama média vermelha
        gfx.fillStyle(0xff4400, 1);
        gfx.fillTriangle(px + 16, py + 10, px + 19, py + 18, px + 16, py + 26);
        gfx.fillTriangle(px + 16, py + 10, px + 13, py + 18, px + 16, py + 26);
        // Núcleo amarelo
        gfx.fillStyle(0xffff66, 1);
        gfx.fillTriangle(px + 16, py + 16, px + 18, py + 22, px + 16, py + 26);
        gfx.fillTriangle(px + 16, py + 16, px + 14, py + 22, px + 16, py + 26);
        break;
      }
      case "deco_stars": {
        gfx.fillStyle(0xffffff, 1);
        for (const [dx, dy] of [[6,6],[24,10],[14,18],[28,22],[4,26],[18,28]] as [number,number][]) {
          gfx.fillRect(px + dx, py + dy, 1, 1);
          gfx.fillRect(px + dx - 1, py + dy, 3, 1);
          gfx.fillRect(px + dx, py + dy - 1, 1, 3);
        }
        gfx.fillStyle(0xffe88a, 1);
        gfx.fillRect(px + 20, py + 6, 1, 1);
        gfx.fillRect(px + 10, py + 22, 1, 1);
        break;
      }
      case "deco_cloud": {
        gfx.fillStyle(0xffffff, 0.95);
        for (const [dx, dy, r] of [[10,16,5],[16,12,6],[22,16,5],[16,18,7]] as [number,number,number][]) {
          gfx.fillCircle(px + dx, py + dy, r);
        }
        gfx.fillStyle(0xb4bed2, 0.6);
        for (const [dx, dy, r] of [[10,20,3],[22,20,3]] as [number,number,number][]) {
          gfx.fillCircle(px + dx, py + dy, r);
        }
        break;
      }
    }
  }

  private showTileGrid(this: Phaser.Scene & WorldScene) {
    // Scene pode estar em destroy → this.add é null
    if (!this.add) return;
    if (this.tileGridGfx) { this.tileGridGfx.destroy(); this.tileGridGfx = null; }
    this.tileGridGfx = this.add.graphics().setDepth(50).setAlpha(0.18);
    this.tileGridGfx.lineStyle(1, 0xffffff, 1);
    for (let x = 0; x <= MW; x++) {
      this.tileGridGfx.moveTo(x * T, 0);
      this.tileGridGfx.lineTo(x * T, WORLD_H);
    }
    for (let y = 0; y <= MH; y++) {
      this.tileGridGfx.moveTo(0, y * T);
      this.tileGridGfx.lineTo(WORLD_W, y * T);
    }
    this.tileGridGfx.strokePath();
  }

  // ─── Tile Layer: painting ──────────────────────────────────────

  private applyTilePaint(this: Phaser.Scene & WorldScene, ptr: Phaser.Input.Pointer) {
    if (!this.tileLayerState) {
      this.tileLayerState = { gridW: MW, gridH: MH, tileSize: T, cells: {} };
      if (!this.tileFloorGfx) {
        this.tileFloorGfx   = this.add.graphics().setDepth(1);
        this.tileWallGfx    = this.add.graphics().setDepth(3);
        this.tileDecoGfx    = this.add.graphics().setDepth(15);
        this.tileOverlayGfx = this.add.graphics().setDepth(30);
      }
    }
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / T);
    const ty = Math.floor(wp.y / T);
    if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) return;
    const key = `${tx},${ty}`;
    const cells = this.tileLayerState.cells;

    if (this.currentTileTool === "paint") {
      const c = { ...this.currentTileCell };
      c.layer = this.resolveTileLayer(c.texture, c.layer);
      cells[key] = c;
    } else if (this.currentTileTool === "erase") {
      delete cells[key];
    } else if (this.currentTileTool === "fill") {
      const target = cells[key];
      this.floodFillTile(tx, ty, target ?? null);
    }
    this.scheduleSyncTiles();
  }

  /** Converte coordenadas do pointer em coordenadas de tile (clamp ao grid). */
  private worldToTile(
    this: Phaser.Scene & WorldScene,
    ptr: Phaser.Input.Pointer,
  ): { tx: number; ty: number } | null {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / T);
    const ty = Math.floor(wp.y / T);
    if (tx < -1 || tx > MW || ty < -1 || ty > MH) return null;
    return {
      tx: Math.max(0, Math.min(MW - 1, tx)),
      ty: Math.max(0, Math.min(MH - 1, ty)),
    };
  }

  /**
   * Aplica a célula atual (ou apaga) em todo o retângulo de tiles
   * entre (x1,y1) e (x2,y2) — inclusivo nas duas pontas.
   */
  private applyTileRect(
    this: Phaser.Scene & WorldScene,
    x1: number, y1: number, x2: number, y2: number,
    erase: boolean,
  ) {
    if (!this.tileLayerState) {
      this.tileLayerState = { gridW: MW, gridH: MH, tileSize: T, cells: {} };
      if (!this.tileFloorGfx) {
        this.tileFloorGfx   = this.add.graphics().setDepth(1);
        this.tileWallGfx    = this.add.graphics().setDepth(3);
        this.tileDecoGfx    = this.add.graphics().setDepth(15);
        this.tileOverlayGfx = this.add.graphics().setDepth(30);
      }
    }
    const xMin = Math.max(0, Math.min(x1, x2));
    const yMin = Math.max(0, Math.min(y1, y2));
    const xMax = Math.min(MW - 1, Math.max(x1, x2));
    const yMax = Math.min(MH - 1, Math.max(y1, y2));
    const cells = this.tileLayerState.cells;

    if (erase) {
      for (let tx = xMin; tx <= xMax; tx++) {
        for (let ty = yMin; ty <= yMax; ty++) {
          delete cells[`${tx},${ty}`];
        }
      }
    } else {
      const base = { ...this.currentTileCell };
      base.layer = this.resolveTileLayer(base.texture, base.layer);
      for (let tx = xMin; tx <= xMax; tx++) {
        for (let ty = yMin; ty <= yMax; ty++) {
          cells[`${tx},${ty}`] = { ...base };
        }
      }
    }
    this.scheduleSyncTiles();
  }

  /** Desenha o retângulo-fantasma (feedback visual durante o drag). */
  private drawRectPreview(this: Phaser.Scene & WorldScene) {
    if (!this.rectStart || !this.rectPreviewEnd) return;
    if (!this.rectPreviewGfx) {
      this.rectPreviewGfx = this.add.graphics().setDepth(55);
    }
    const g = this.rectPreviewGfx;
    const erase = this.currentTileTool === "rect-erase";
    const fillColor  = erase ? 0xef4444 : 0x6366f1;
    const strokeColor = erase ? 0xff6b6b : 0x818cf8;

    const xMin = Math.min(this.rectStart.tx, this.rectPreviewEnd.tx);
    const yMin = Math.min(this.rectStart.ty, this.rectPreviewEnd.ty);
    const xMax = Math.max(this.rectStart.tx, this.rectPreviewEnd.tx);
    const yMax = Math.max(this.rectStart.ty, this.rectPreviewEnd.ty);
    const w = (xMax - xMin + 1) * T;
    const h = (yMax - yMin + 1) * T;

    g.clear();
    g.fillStyle(fillColor, 0.25);
    g.fillRect(xMin * T, yMin * T, w, h);
    g.lineStyle(2, strokeColor, 0.9);
    g.strokeRect(xMin * T, yMin * T, w, h);
  }

  private clearRectPreview(this: Phaser.Scene & WorldScene) {
    if (this.rectPreviewGfx) {
      this.rectPreviewGfx.destroy();
      this.rectPreviewGfx = null;
    }
  }

  private floodFillTile(
    this: Phaser.Scene & WorldScene,
    startX: number,
    startY: number,
    targetCell: TileCell | null,
  ) {
    const cells = this.tileLayerState!.cells;
    const fill = { ...this.currentTileCell };
    fill.layer = this.resolveTileLayer(fill.texture, fill.layer);
    const targetKey = targetCell ? `${targetCell.texture}:${targetCell.layer}` : "__empty__";
    const fillKey   = `${fill.texture}:${fill.layer}`;
    if (targetKey === fillKey) return; // already same

    const queue: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const k = `${x},${y}`;
      const existing = cells[k] ?? null;
      const existingKey = existing ? `${existing.texture}:${existing.layer}` : "__empty__";
      if (existingKey !== targetKey) continue;
      if (targetCell === null) {
        cells[k] = { ...fill };
      } else {
        cells[k] = { ...fill };
      }
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]] as [number,number][]) {
        if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) continue;
        const nk = `${nx},${ny}`;
        if (visited.has(nk)) continue;
        visited.add(nk);
        queue.push([nx, ny]);
      }
    }
  }

  private scheduleSyncTiles(this: Phaser.Scene & WorldScene) {
    if (this._tileSyncTimer) clearTimeout(this._tileSyncTimer);
    this._tileSyncTimer = setTimeout(() => {
      this._tileSyncTimer = null;
      this.syncTileRendering();
      if (this.tileLayerState) {
        // Cria uma nova referência para que o React detecte a mudança via Object.is.
        const snapshot: TileLayer = {
          ...this.tileLayerState,
          cells: { ...this.tileLayerState.cells },
        };
        window.dispatchEvent(new CustomEvent("space-station:tile-layer-changed", {
          detail: { tileLayer: snapshot },
        }));
      }
    }, 80);
  }

  // ─── Resize handles for placed objects ────────────────────────

  private showResizeHandles(this: Phaser.Scene & WorldScene, spr: Phaser.GameObjects.Image) {
    this.clearResizeHandles();
    const hw = spr.displayWidth  / 2;
    const hh = spr.displayHeight / 2;

    // Textura ainda não carregou → dimensões zeradas, impossível calcular escala
    if (hw < 1 || hh < 1) return;

    this.resizeOrigScale = spr.scale;
    this.resizeOrigDist  = Math.hypot(hw, hh);

    const corners: [number, number][] = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]];
    for (const [dx, dy] of corners) {
      const h = this.add.rectangle(spr.x + dx, spr.y + dy, 14, 14, 0xffffff)
        .setDepth(200)
        .setStrokeStyle(2, 0x6366f1)
        .setInteractive({ useHandCursor: true, draggable: true });

      h.on("drag", (_p: unknown, wx: number, wy: number) => {
        if (this.resizeOrigDist < 1) return; // guard contra divisão por zero
        const dist = Math.hypot(wx - spr.x, wy - spr.y);
        const newScale = Math.max(0.05, (dist / this.resizeOrigDist) * this.resizeOrigScale);
        spr.setScale(newScale);
        this.repositionResizeHandles(spr);
        // Atualiza o highlight de seleção sem recriar as alças
        const hl = this.placedObjectHighlights.get(this.editorSelectedId ?? "");
        if (hl) {
          const w2 = spr.displayWidth  / 2;
          const h2 = spr.displayHeight / 2;
          hl.clear();
          hl.lineStyle(2, 0x6366f1, 0.9);
          hl.strokeRect(-w2 - 3, -h2 - 3, w2 * 2 + 6, h2 * 2 + 6);
          hl.lineStyle(1, 0xa5b4fc, 0.5);
          hl.strokeRect(-w2 - 6, -h2 - 6, w2 * 2 + 12, h2 * 2 + 12);
        }
        window.dispatchEvent(new CustomEvent("space-station:object-resized", {
          detail: { id: this.editorSelectedId, scale: newScale },
        }));
      });

      // Ao soltar, atualiza os limites das alças com a nova escala final
      h.on("dragend", () => {
        this.resizeOrigScale = spr.scale;
        this.resizeOrigDist  = Math.hypot(spr.displayWidth / 2, spr.displayHeight / 2);
        this.repositionResizeHandles(spr);
      });

      this.resizeHandles.push(h);
    }
  }

  private clearResizeHandles(this: Phaser.Scene & WorldScene) {
    this.resizeHandles.forEach(h => {
      try { h.destroy(); } catch { /* ignore destroyed sprites */ }
    });
    this.resizeHandles = [];
  }

  private repositionResizeHandles(this: Phaser.Scene & WorldScene, spr: Phaser.GameObjects.Image) {
    const hw = spr.displayWidth  / 2;
    const hh = spr.displayHeight / 2;
    const corners: [number, number][] = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]];
    this.resizeHandles.forEach((h, i) => {
      const [dx, dy] = corners[i];
      h.setPosition(spr.x + dx, spr.y + dy);
    });
  }

  /** Habilita/desabilita drop HTML → coordenadas do mundo Phaser. */
  private setupEditorDOMDrop(active: boolean) {
    const canvas = (this.sys?.game?.canvas ?? null) as HTMLCanvasElement | null;
    if (!canvas) return;
    // Remove listeners anteriores (armazenados em dataset para idempotência)
    const existing = (canvas as unknown as { __editorDropCleanup?: () => void }).__editorDropCleanup;
    if (existing) {
      existing();
      (canvas as unknown as { __editorDropCleanup?: () => void }).__editorDropCleanup = undefined;
    }
    if (!active) return;

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("application/x-map-object")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e: DragEvent) => {
      const raw = e.dataTransfer?.getData("application/x-map-object");
      if (!raw) return;
      e.preventDefault();
      let item: unknown;
      try { item = JSON.parse(raw); } catch { return; }
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      // Converte coords de tela → coords do mundo
      const cam = this.cameras.main;
      const worldX = cam.worldView.x + screenX / cam.zoom * (rect.width / cam.width);
      const worldY = cam.worldView.y + screenY / cam.zoom * (rect.height / cam.height);
      // Fallback mais robusto usando getWorldPoint
      const wp = cam.getWorldPoint(screenX, screenY);
      window.dispatchEvent(new CustomEvent("space-station:object-dropped", {
        detail: { item, x: wp.x || worldX, y: wp.y || worldY },
      }));
    };

    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("drop",     onDrop);
    (canvas as unknown as { __editorDropCleanup?: () => void }).__editorDropCleanup = () => {
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("drop",     onDrop);
    };
  }

  // ─── Tiled map scenario ────────────────────────────────────────

  private renderTiledMap(this: Phaser.Scene & WorldScene) {
    if (!this.tiledCanvas) return;

    // Registra o canvas pré-renderizado como textura Phaser (sem toBlob, sem load)
    if (this.textures.exists("__tiled_bg__")) {
      this.textures.remove("__tiled_bg__");
    }
    this.textures.addCanvas("__tiled_bg__", this.tiledCanvas);

    // Adiciona como imagem de fundo
    this.add.image(0, 0, "__tiled_bg__")
      .setOrigin(0, 0)
      .setDepth(0);

    // Ajusta bounds do mundo ao tamanho do mapa Tiled
    this.physics.world.setBounds(0, 0, this.tiledMapW, this.tiledMapH);
  }

  /** Renderiza imagem única (cenário "image") como fundo do mundo.
   *  O usuário sobe uma imagem (pixel-art ou foto) e o avatar anda em
   *  cima dela. Áreas de colisão (Map Editor → Áreas → Colisão) controlam
   *  paredes / móveis em que ele não pode passar. */
  private renderImageBackground(this: Phaser.Scene & WorldScene) {
    const raw = this.worldConfig?.mapData as WorldMapData | null;
    if (!this.textures.exists("__bg_image__")) {
      // Imagem ainda não carregou (preload pulou ou falhou) — desenha um
      // fallback neutro pra o avatar não ficar no preto.
      const w = raw?.backgroundImageWidth ?? WORLD_W;
      const h = raw?.backgroundImageHeight ?? WORLD_H;
      this.add.rectangle(0, 0, w, h, 0x1a1a2e).setOrigin(0, 0).setDepth(0);
      return;
    }
    const img = this.add
      .image(0, 0, "__bg_image__")
      .setOrigin(0, 0)
      .setDepth(0);
    // Se o user definiu dimensões customizadas, escala a imagem
    const customW = raw?.backgroundImageWidth;
    const customH = raw?.backgroundImageHeight;
    if (customW && customH) {
      img.setDisplaySize(customW, customH);
    }
  }

  // ─── Station scenario ─────────────────────────────────────────

  private drawStation(this: Phaser.Scene & WorldScene, el: WorldElementsConfig, rooms: RoomConfig[], meetingCount: number) {
    // Outdoor area first (drawn below office)
    this.drawOutdoor(el);

    const g = this.add.graphics().setDepth(1);

    // Office exterior walls (top)
    this.fillRect(g, C.WALL, 0, 0, WORLD_W, WALL_T * 2);
    this.addWall(0, 0, WORLD_W, WALL_T * 2);

    // Office floor
    this.fillRect(g, C.FLOOR, 0, WALL_T * 2, WORLD_W, OFFICE_H - WALL_T * 4);

    // Subtle floor grid
    g.lineStyle(1, C.FLOOR_LINE, 0.3);
    for (let x = 0; x <= WORLD_W; x += T) { g.moveTo(x, WALL_T * 2); g.lineTo(x, OFFICE_H - WALL_T * 2); }
    for (let y = WALL_T * 2; y <= OFFICE_H - WALL_T * 2; y += T) { g.moveTo(0, y); g.lineTo(WORLD_W, y); }
    g.strokePath();

    // Left wall
    this.fillRect(g, C.WALL, 0, WALL_T * 2, WALL_T * 2, OFFICE_H - WALL_T * 4);
    this.addWall(0, WALL_T * 2, WALL_T * 2, OFFICE_H - WALL_T * 4);

    // Right wall
    this.fillRect(g, C.WALL, WORLD_W - WALL_T * 2, WALL_T * 2, WALL_T * 2, OFFICE_H - WALL_T * 4);
    this.addWall(WORLD_W - WALL_T * 2, WALL_T * 2, WALL_T * 2, OFFICE_H - WALL_T * 4);

    // Bottom wall with door gap in center
    const doorW = WALL_T * 3;
    const doorX = WORLD_W / 2 - doorW / 2;
    this.fillRect(g, C.WALL, 0, OFFICE_H - WALL_T * 2, WORLD_W, WALL_T * 2);
    this.fillRect(g, C.FLOOR, doorX, OFFICE_H - WALL_T * 2, doorW, WALL_T * 2); // door gap
    this.addWall(0, OFFICE_H - WALL_T * 2, doorX, WALL_T * 2);
    this.addWall(doorX + doorW, OFFICE_H - WALL_T * 2, WORLD_W - (doorX + doorW), WALL_T * 2);

    // Windows on top wall
    const wg = this.add.graphics().setDepth(3);
    for (let wx = T * 4; wx < WORLD_W - T * 3; wx += T * 8) {
      this.fillRect(wg, 0x9a8e80, wx, T * 0.5, T * 5, T * 1.2);
      this.fillRect(wg, 0xa8d8f0, wx + 4, T * 0.6, T * 5 - 8, T);
    }

    // Corridor divider between coworking and rooms
    const divX = ROOM_COL_X - WALL_T;
    this.fillRect(g, C.WALL_INT, divX, WALL_T * 2, WALL_T, OFFICE_H - WALL_T * 4);
    this.addWall(divX, WALL_T * 2, WALL_T, OFFICE_H - WALL_T * 4);

    // Coworking area (left of room column)
    const cowrkRoom = rooms.find((r) => r.type === "coworking");
    if (cowrkRoom?.enabled) {
      this.drawCoworking(g, WALL_T * 2, WALL_T * 2, divX - WALL_T * 2, OFFICE_H - WALL_T * 4, el);
    }

    // Rooms on right column
    this.drawRoomColumn(rooms, meetingCount, el);

    // Plants + cabinets in coworking
    if (el.showPlants) {
      const pg = this.add.graphics().setDepth(6);
      [
        [WALL_T * 3, WALL_T * 3], [WALL_T * 3, WALL_T * 10],
        [divX - T * 3, WALL_T * 3], [divX - T * 3, WALL_T * 10],
      ].forEach(([px, py]) => this.drawPlant(pg, px, py));
    }

    if (el.showCabinets) {
      const cg = this.add.graphics().setDepth(5);
      for (let cy = WALL_T * 3; cy < OFFICE_H - T * 6; cy += T * 4) {
        this.fillRect(cg, 0xb0a090, WALL_T * 2, cy, WALL_T * 1.5, T * 2);
        cg.lineStyle(1, 0x8a7a6a, 0.5);
        cg.strokeRect(WALL_T * 2, cy + 2, WALL_T * 1.5 - 4, T * 2 - 4);
      }
    }
  }

  private drawCoworking(this: Phaser.Scene & WorldScene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, el: WorldElementsConfig) {
    const cols = Math.floor(w / (T * 5));
    const rows = Math.floor(h / (T * 4));
    const dg = this.add.graphics().setDepth(5);
    const startX = x + T * 3;
    const startY = y + T * 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const dx = startX + col * T * 5;
        const dy = startY + row * T * 4;
        if (dx + T * 4 > x + w - T) continue;
        this.drawDesk(dg, dx, dy, T * 4, T * 2, el.deskType, el.chairType);
      }
    }

    // Lounge rug
    const rg = this.add.graphics().setDepth(2);
    this.fillRect(rg, 0x8a6a94, x + T * 2, y + h - T * 7, T * 12, T * 5, 0.2);
    // Lounge chairs
    for (let i = 0; i < 3; i++) {
      this.fillRect(rg, 0x6a7e8a, x + T * 3 + i * T * 4, y + h - T * 6, T * 3, T * 2);
      this.fillRect(rg, 0x8a9ba8, x + T * 3 + i * T * 4 + 4, y + h - T * 6 + 4, T * 3 - 8, T * 2 - 8, 0.7);
    }
  }

  private drawRoomColumn(this: Phaser.Scene & WorldScene, rooms: RoomConfig[], meetingCount: number, el: WorldElementsConfig) {
    const enabledRooms: RoomType[] = [];

    for (const r of rooms) {
      if (!r.enabled) continue;
      if (r.type === "coworking") continue; // handled separately
      if (r.type === "reuniao") {
        for (let i = 0; i < meetingCount; i++) enabledRooms.push("reuniao");
      } else {
        enabledRooms.push(r.type);
      }
    }

    let roomY = WALL_T * 2;
    const rg = this.add.graphics().setDepth(3);

    for (const type of enabledRooms) {
      if (roomY + ROOM_H > OFFICE_H - WALL_T * 2) break; // no space
      this.drawRoom(rg, type, ROOM_COL_X, roomY, ROOM_W, ROOM_H, el);
      roomY += ROOM_H + ROOM_GAP;
    }
  }

  // ─── Room drawing with door + physics ────────────────────────

  private drawRoom(this: Phaser.Scene & WorldScene, g: Phaser.GameObjects.Graphics, type: RoomType, rx: number, ry: number, rw: number, rh: number, el: WorldElementsConfig) {
    const floorColor = ROOM_FLOOR_COLOR[type];

    // Floor
    this.fillRect(g, floorColor, rx, ry, rw, rh);

    // Walls (visual)
    this.fillRect(g, C.WALL_INT, rx,               ry,               rw, WALL_T); // top
    this.fillRect(g, C.WALL_INT, rx,               ry + rh - WALL_T, rw, WALL_T); // bottom
    this.fillRect(g, C.WALL_INT, rx,               ry,               WALL_T, rh); // left
    this.fillRect(g, C.WALL_INT, rx + rw - WALL_T, ry,               WALL_T, rh); // right

    // Door on left wall — centered vertically
    const doorStart = ry + (rh - DOOR_W) / 2;
    // Paint floor color over left wall for the door gap
    this.fillRect(g, floorColor, rx, doorStart, WALL_T, DOOR_W);
    // Arrow indicator on floor near door
    g.fillStyle(0xffffff, 0.15);
    g.fillTriangle(rx + WALL_T + 4, doorStart + DOOR_W / 2, rx + WALL_T + 20, doorStart + 4, rx + WALL_T + 20, doorStart + DOOR_W - 4);

    // Room label
    this.add.text(rx + rw / 2, ry + 12, `${ROOM_META[type].emoji} ${ROOM_META[type].label}`, {
      fontSize: "9px", color: "#334455", backgroundColor: "#ffffff44", padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(8);

    // Physics walls
    this.addWall(rx,               ry,               rw, WALL_T); // top
    this.addWall(rx,               ry + rh - WALL_T, rw, WALL_T); // bottom
    this.addWall(rx + rw - WALL_T, ry + WALL_T,      WALL_T, rh - WALL_T * 2); // right

    // Left wall with door gap
    const topH = doorStart - ry - WALL_T;
    if (topH > 0) this.addWall(rx, ry + WALL_T, WALL_T, topH);
    const botStart = doorStart + DOOR_W;
    const botH = (ry + rh - WALL_T) - botStart;
    if (botH > 0) this.addWall(rx, botStart, WALL_T, botH);

    // Room interior
    const ig = this.add.graphics().setDepth(5);
    const ix = rx + WALL_T + 4, iy = ry + WALL_T + 4;
    const iw = rw - WALL_T * 2 - 8, ih = rh - WALL_T * 2 - 8;
    this.drawRoomInterior(ig, type, ix, iy, iw, ih, el);
  }

  private drawRoomInterior(g: Phaser.GameObjects.Graphics, type: RoomType, x: number, y: number, w: number, h: number, el: WorldElementsConfig) {
    switch (type) {
      case "copa":        this.drawCopa(g, x, y, w, h);        break;
      case "cozinha":     this.drawCozinha(g, x, y, w, h);     break;
      case "atendimento": this.drawAtendimento(g, x, y, w, h); break;
      case "reuniao":     this.drawReuniao(g, x, y, w, h, el); break;
      case "recepcao":    this.drawRecepcao(g, x, y, w, h);    break;
      case "coworking":   break;
    }
  }

  private drawCopa(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Counter along top wall
    this.fillRect(g, 0xc0a060, x, y, w, T * 1.5);
    this.fillRect(g, 0x8a6a30, x, y, w, 6);
    // Coffee machine
    this.fillRect(g, 0x333333, x + 8, y + 6, 24, 24);
    this.fillRect(g, 0x222222, x + 12, y + 10, 16, 10);
    this.fillRect(g, 0xc0392b, x + 32, y + 10, 8, 8); // red button
    // Microwave
    this.fillRect(g, 0x555555, x + w - 50, y + 4, 40, 30);
    this.fillRect(g, 0x000000, x + w - 48, y + 6, 28, 20);
    this.fillRect(g, 0xffffff, x + w - 48, y + 6, 28, 20, 0.1);

    // Round tables with chairs
    const tables: [number, number][] = [[x + w * 0.3, y + h * 0.6], [x + w * 0.7, y + h * 0.6]];
    for (const [tx, ty] of tables) {
      this.circle(g, 0xa08060, tx, ty, 20);
      g.lineStyle(2, 0x8a6040, 0.8); g.strokeCircle(tx, ty, 20);
      for (const [cx, cy] of [[-26, 0], [26, 0], [0, -26], [0, 26]]) {
        this.fillRect(g, 0x6a7e8a, tx + cx - 7, ty + cy - 7, 14, 14);
        this.fillRect(g, 0x8a9ba8, tx + cx - 5, ty + cy - 5, 10, 10, 0.7);
      }
    }
  }

  private drawCozinha(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Counter along left & top
    this.fillRect(g, 0xb8a080, x, y, w * 0.35, h);      // left counter
    this.fillRect(g, 0xb8a080, x, y, w, T * 1.5);         // top counter
    this.fillRect(g, 0x8a6a40, x, y, 4, h);
    // Sink
    this.fillRect(g, 0xaaaaaa, x + 10, y + T * 0.6, 40, 30);
    this.fillRect(g, 0x888888, x + 12, y + T * 0.6 + 2, 36, 26);
    this.circle(g, 0x444444, x + 30, y + T * 0.4, 4);
    // Stove
    this.fillRect(g, 0x333333, x + 60, y + T * 0.3, 50, 50);
    for (const [bx, by] of [[8, 8], [28, 8], [8, 28], [28, 28]]) {
      this.circle(g, 0x222222, x + 60 + bx + 6, y + T * 0.3 + by + 6, 10);
      this.circle(g, 0x555555, x + 60 + bx + 6, y + T * 0.3 + by + 6, 6);
    }
    // Table
    const tx = x + w * 0.6, ty = y + h * 0.6;
    this.fillRect(g, 0xa08060, tx - 30, ty - 20, 60, 40);
    for (const [cx, cy] of [[-38, 0], [32, 0]]) {
      this.fillRect(g, 0x6a7e8a, tx + cx, ty - 8, 14, 16);
    }
  }

  private drawAtendimento(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Reception desk (L-shaped)
    this.fillRect(g, 0xc4a882, x, y + h * 0.3, w * 0.6, T * 1.5); // horizontal
    this.fillRect(g, 0xc4a882, x, y + h * 0.3, T * 1.5, h * 0.5); // vertical part
    this.fillRect(g, 0x9e8060, x, y + h * 0.3 + T * 1.5 - 4, w * 0.6, 4); // edge
    // Monitor on desk
    this.fillRect(g, 0x1a2535, x + T * 2, y + h * 0.3 + 4, 22, 16);
    this.fillRect(g, 0x2a6aff, x + T * 2 + 2, y + h * 0.3 + 6, 18, 12, 0.5);
    // Waiting chairs
    for (let i = 0; i < 3; i++) {
      this.fillRect(g, 0x6a7e8a, x + w * 0.65 + i * (T + 4), y + h * 0.5, T, T * 1.2);
      this.fillRect(g, 0x8a9ba8, x + w * 0.65 + i * (T + 4) + 4, y + h * 0.5 + 4, T - 8, T * 0.8, 0.7);
    }
    // Sign
    this.fillRect(g, 0x7c3aed, x + w * 0.65, y + h * 0.15, w * 0.25, T);
    this.add.text(x + w * 0.65 + w * 0.125, y + h * 0.15 + T / 2, "ATENDIMENTO", {
      fontSize: "7px", color: "#ffffff", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(6);
  }

  private drawReuniao(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, el: WorldElementsConfig) {
    // Meeting table (oval-ish)
    const tx = x + w / 2, ty = y + h / 2;
    const tw = Math.min(w - T * 2, 160), th = T * 1.5;
    this.fillRect(g, 0x5d8a9a, tx - tw / 2, ty - th / 2, tw, th);
    g.lineStyle(2, 0x4a7080, 0.8); g.strokeRect(tx - tw / 2, ty - th / 2, tw, th);
    // Chairs
    const chairType = el.chairType;
    const cols = Math.floor(tw / 32);
    for (let i = 0; i < cols; i++) {
      const cx = tx - tw / 2 + 16 + i * 32;
      this.drawChair(g, cx - 8, ty - th / 2 - T + 2, 16, chairType);
      this.drawChair(g, cx - 8, ty + th / 2 + 2,     16, chairType);
    }
    // TV/whiteboard
    this.fillRect(g, 0x1a2535, tx - 40, y + 4, 80, T + 8);
    this.fillRect(g, 0x2a3aff, tx - 38, y + 6, 76, T + 4, 0.5);
    g.lineStyle(2, 0xffffff, 0.3); g.strokeRect(tx - 40, y + 4, 80, T + 8);
  }

  private drawRecepcao(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Reception desk
    this.fillRect(g, 0xc4a882, x + w * 0.1, y + h * 0.2, w * 0.8, T * 1.5);
    this.fillRect(g, 0x9e8060, x + w * 0.1, y + h * 0.2 + T * 1.5 - 4, w * 0.8, 4);
    // Logo area
    this.fillRect(g, 0x4f46e5, x + w / 2 - 24, y + 8, 48, 20);
    this.add.text(x + w / 2, y + 18, "NASA", {
      fontSize: "8px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(6);
    // Welcome chairs
    for (let i = 0; i < 4; i++) {
      this.fillRect(g, 0x7c3aed, x + w * 0.1 + i * (T + 4), y + h * 0.6, T, T);
      this.fillRect(g, 0x9a5cf6, x + w * 0.1 + i * (T + 4) + 3, y + h * 0.6 + 3, T - 6, T - 6, 0.7);
    }
    // Plant
    this.drawPlant(g, x + w - T * 2, y + h * 0.6);
    this.drawPlant(g, x + T,          y + h * 0.6);
  }

  // ─── Outdoor ─────────────────────────────────────────────────

  private drawOutdoor(this: Phaser.Scene & WorldScene, el: WorldElementsConfig) {
    if (!el.showGrass) return;
    const g = this.add.graphics().setDepth(0);
    const oy = OFFICE_H;

    this.fillRect(g, C.GRASS, 0, oy, WORLD_W, WORLD_H - oy);
    for (let i = 0; i < 60; i++) {
      const px = Math.floor(Math.random() * MW) * T;
      const py = oy + Math.floor(Math.random() * (MH - OFFICE_ROWS)) * T;
      this.fillRect(g, C.GRASS_DARK, px, py, T, T, 0.22);
    }
    // River
    const rv = WORLD_H - 6 * T;
    this.fillRect(g, C.WATER_DARK, 0, rv, WORLD_W, 6 * T);
    this.fillRect(g, C.WATER, 0, rv + 8, WORLD_W, 6 * T - 24);
    for (let x = 0; x < WORLD_W; x += 96) {
      this.fillRect(g, C.WATER_LIGHT, x + 16, rv + 24, 48, 5, 0.6);
    }
    this.fillRect(g, C.GRASS_DARK, 0, rv - 6, WORLD_W, 10);
    // Center path
    this.fillRect(g, C.PATH, WORLD_W / 2 - 48, oy, 96, 200);

    if (el.showTrees) {
      const tg = this.add.graphics().setDepth(5);
      const treePts: [number, number][] = [
        [2,31],[6,32],[11,31],[17,33],[23,31],[29,32],[35,31],[41,33],[47,31],[53,32],[59,31],[65,33],[71,31],[77,32],
        [3,35],[8,36],[14,34],[20,36],[26,35],[32,34],[38,36],[44,34],[50,36],[56,35],[62,34],[68,36],[74,34],[78,35],
        [4,39],[10,40],[16,38],[22,40],[28,39],[34,38],[40,40],[46,39],[52,38],[58,40],[64,39],[70,38],[76,40],
      ];
      for (const [tx, ty] of treePts) {
        const px = tx * T + T / 2, py = ty * T + T / 2;
        this.circle(tg, 0x000000, px + 4, py + 8, 14, 0.18);
        this.fillRect(tg, C.TRUNK, px - 4, py - 4, 8, 14);
        this.circle(tg, C.TREE_SHADOW, px, py - 12, 18);
        this.circle(tg, C.TREE_TOP, px, py - 16, 16);
        this.circle(tg, C.GRASS_LIGHT, px - 4, py - 20, 9, 0.45);
      }
    }

    if (el.showFlowers) {
      const fg = this.add.graphics().setDepth(4);
      const fc = [C.FLOWER_R, C.FLOWER_Y, C.FLOWER_W];
      for (let i = 0; i < 100; i++) {
        const fx = Math.random() * WORLD_W;
        const fy = oy + 16 + Math.random() * (WORLD_H - oy - 200);
        this.circle(fg, fc[Math.floor(Math.random() * 3)], fx, fy, 3);
      }
    }
  }

  // ─── Space + Rocket scenarios (unchanged) ─────────────────────

  private drawSpace(this: Phaser.Scene & WorldScene) {
    const g = this.add.graphics().setDepth(0);
    this.fillRect(g, C.SPACE_BG, 0, 0, WORLD_W, WORLD_H);
    const ng = this.add.graphics().setDepth(1);
    [[0.15,0.2,400,C.NEBULA1],[0.6,0.4,500,C.NEBULA2],[0.4,0.75,380,0x501020],[0.85,0.15,300,C.NEBULA1]].forEach(([rx,ry,r,col]) => {
      this.circle(ng, col as number, (rx as number)*WORLD_W, (ry as number)*WORLD_H, r as number, 0.18);
    });
    const sg = this.add.graphics().setDepth(2);
    for (let i = 0; i < 600; i++) this.circle(sg, 0xffffff, Math.random()*WORLD_W, Math.random()*WORLD_H, Math.random()*2+0.3, Math.random()*0.6+0.3);
    const ag = this.add.graphics().setDepth(3);
    [[0.12,0.1,80],[0.35,0.08,60],[0.65,0.12,90],[0.88,0.08,70],[0.08,0.3,100],[0.5,0.25,120],[0.82,0.3,85],[0.25,0.5,95],[0.72,0.48,110],[0.45,0.65,80],[0.15,0.7,75],[0.6,0.72,90],[0.88,0.65,65],[0.3,0.85,100],[0.7,0.88,88]].forEach(([rx,ry,r]) => {
      const ax=rx*WORLD_W, ay=ry*WORLD_H;
      this.circle(ag,C.ASTEROID,ax,ay,r as number);
      this.circle(ag,C.ASTEROID_LIT,ax-(r as number)*0.3,ay-(r as number)*0.3,(r as number)*0.6,0.5);
      this.addWall(ax - (r as number), ay - (r as number), (r as number)*2, (r as number)*2);
    });
    const pg = this.add.graphics().setDepth(4);
    [[0.4,0.35,240,80],[0.55,0.35,200,70],[0.47,0.5,180,70],[0.4,0.6,160,60],[0.58,0.58,220,65]].forEach(([rx,ry,w,h]) => {
      const mx=rx*WORLD_W-w/2, my=ry*WORLD_H-h/2;
      this.fillRect(pg,C.PLATFORM,mx,my,w as number,h as number);
      pg.lineStyle(2,C.PLATFORM_GLOW,0.6); pg.strokeRect(mx,my,w as number,h as number);
      this.addWall(mx, my, w as number, h as number);
    });
  }

  private drawRocket(this: Phaser.Scene & WorldScene) {
    const g = this.add.graphics().setDepth(0);
    this.fillRect(g, C.ROCKET_HULL, 0, 0, WORLD_W, WORLD_H);
    for (let y = 0; y < WORLD_H; y += T*4) {
      for (let x = 0; x < WORLD_W; x += T*6) {
        this.fillRect(g, C.ROCKET_PANEL, x, y, T*6-2, T*4-2);
        g.lineStyle(1, 0x2a3a5e, 0.4); g.strokeRect(x, y, T*6-2, T*4-2);
      }
    }
    const rg = this.add.graphics().setDepth(3);
    // Cockpit
    this.fillRect(rg, 0x0a1020, 0, T*2, WORLD_W, T*10);
    this.addWall(0, T*2, WORLD_W, T*1.5);
    this.addWall(0, T*11, WORLD_W, T*1.5);
    const winW=WORLD_W*0.7, winH=T*7, winX=(WORLD_W-winW)/2, winY=T*3;
    this.fillRect(rg, C.SPACE_BG, winX, winY, winW, winH);
    const sg = this.add.graphics().setDepth(4);
    for (let i=0;i<150;i++) this.circle(sg,0xffffff,winX+Math.random()*winW,winY+Math.random()*winH,Math.random()*1.5+0.3,Math.random()*0.7+0.3);
    this.circle(sg, 0x3060cc, winX+winW*0.75, winY+winH*0.35, 45, 0.7);
    rg.lineStyle(6,C.ROCKET_METAL,1); rg.strokeRect(winX,winY,winW,winH);
    // Engine room
    const engY = T*35;
    this.fillRect(rg, 0x0a0a18, 0, engY, WORLD_W, WORLD_H-engY);
    this.addWall(0, engY, WORLD_W, T*2);
    [1,2,3,4,5].forEach((e) => {
      const ex=(WORLD_W/(6))*e, ey=engY+T*5;
      this.circle(rg,C.ROCKET_METAL,ex,ey,48);
      this.circle(rg,0x1a1a3e,ex,ey,40);
      this.circle(rg,C.ROCKET_GLOW,ex,ey,22,0.6);
      this.circle(rg,0xffaa00,ex,ey,14,0.7);
    });
  }

  // ─── Lunar Base ──────────────────────────────────────────────
  private drawLunarBase(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    // Moon surface background — grey regolith
    this.fillRect(rg, 0x1a1a20, 0, 0, WORLD_W, WORLD_H);
    // Sky with Earth visible
    this.fillRect(rg, 0x060810, 0, 0, WORLD_W, T * 8);
    // Stars
    const sg = this.add.graphics().setDepth(0);
    for (let i = 0; i < 200; i++)
      this.circle(sg, 0xffffff, Math.random() * WORLD_W, Math.random() * T * 8, Math.random() * 1.2 + 0.3, Math.random() * 0.9 + 0.1);
    // Earth
    this.circle(rg, 0x1a5fb4, WORLD_W * 0.8, T * 4, 80, 0.9);
    this.circle(rg, 0x2ea043, WORLD_W * 0.8 + 20, T * 4 - 15, 30, 0.85);
    this.circle(rg, 0xffffff, WORLD_W * 0.8 - 30, T * 4 - 30, 18, 0.3);

    // Moon ground — cratered
    const groundY = T * 8;
    this.fillRect(rg, 0x2e2e36, 0, groundY, WORLD_W, WORLD_H - groundY);
    // Crater rings
    const craters = [[T*6,groundY+T*3,60],[T*18,groundY+T*6,45],[T*40,groundY+T*2,90],[T*60,groundY+T*7,55],[T*72,groundY+T*4,35]];
    craters.forEach(([cx,cy,r]) => {
      rg.lineStyle(3, 0x4a4a52, 0.7); rg.strokeCircle(cx, cy, r);
      this.circle(rg, 0x1e1e26, cx, cy, r - 4, 0.4);
    });

    // Base dome — central hub
    const domeX = WORLD_W / 2, domeY = groundY + T * 5;
    this.circle(rg, 0x1a2a3a, domeX, domeY, 120, 0.95);
    rg.lineStyle(4, 0x00d4ff, 0.6); rg.strokeCircle(domeX, domeY, 120);
    this.fillRect(rg, 0xd8d0c4, domeX - T * 3, domeY - T, T * 6, T * 3); // floor
    this.addWall(domeX - T * 3, domeY - T, T * 6, T);

    // Connecting tunnels
    const tunnelColor = 0x1e3040;
    this.fillRect(rg, tunnelColor, domeX - T * 8, domeY, T * 5, T * 2); // left tunnel
    this.fillRect(rg, tunnelColor, domeX + T * 3, domeY, T * 5, T * 2); // right tunnel
    rg.lineStyle(3, 0x00d4ff, 0.4);
    rg.strokeRect(domeX - T * 8, domeY, T * 5, T * 2);
    rg.strokeRect(domeX + T * 3, domeY, T * 5, T * 2);

    // Left module
    const lmodX = domeX - T * 16, lmodY = domeY - T;
    this.fillRect(rg, 0x1a2030, lmodX, lmodY, T * 8, T * 4);
    rg.lineStyle(3, 0x3a7abb, 0.8); rg.strokeRect(lmodX, lmodY, T * 8, T * 4);
    this.addWall(lmodX, lmodY, T * 8, T);
    this.addWall(lmodX, lmodY + T * 3, T * 8, T);
    // Desks inside
    for (let d = 0; d < 3; d++) this.fillRect(rg, C.DESK_SPACE, lmodX + T + d * T * 2.5, lmodY + T * 1.5, T * 1.8, T);

    // Right module — lab
    const rmodX = domeX + T * 8, rmodY = domeY - T;
    this.fillRect(rg, 0x1a1a28, rmodX, rmodY, T * 9, T * 4);
    rg.lineStyle(3, 0x9b30ff, 0.8); rg.strokeRect(rmodX, rmodY, T * 9, T * 4);
    this.addWall(rmodX, rmodY, T * 9, T);
    this.addWall(rmodX, rmodY + T * 3, T * 9, T);
    for (let d = 0; d < 3; d++) this.circle(rg, 0x9b30ff, rmodX + T * 1.5 + d * T * 3, rmodY + T * 2, 18, 0.5);

    // Lunar rovers
    [[T*10,groundY+T*12],[T*66,groundY+T*11]].forEach(([rx,ry]) => {
      this.fillRect(rg, 0x4a5060, rx, ry, T * 3, T); // body
      this.circle(rg, 0x2a2a30, rx + T * 0.4, ry + T, 12); // wheel L
      this.circle(rg, 0x2a2a30, rx + T * 2.6, ry + T, 12); // wheel R
    });

    // Solar panels
    [[domeX - T * 20, groundY + T * 2],[domeX + T * 18, groundY + T * 2]].forEach(([px,py]) => {
      this.fillRect(rg, 0x1a3a5a, px, py, T * 4, T * 1.5);
      rg.lineStyle(1, 0x3a7aaa, 0.7);
      for (let i = 1; i < 4; i++) { rg.moveTo(px + T * i, py); rg.lineTo(px + T * i, py + T * 1.5); }
      rg.strokePath();
    });

    // Astronauts (decorative)
    [[domeX - T * 5, domeY + T * 3],[domeX + T * 4, domeY + T * 2]].forEach(([ax,ay]) => {
      this.circle(rg, 0xffffff, ax, ay - T * 0.8, 10, 0.9); // helmet
      this.fillRect(rg, 0xdddddd, ax - 6, ay - T * 0.3, 12, T); // suit
    });
  }

  // ─── Mission Control ─────────────────────────────────────────
  private drawMissionControl(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    // Deep dark floor
    this.fillRect(rg, 0x080c14, 0, 0, WORLD_W, WORLD_H);

    // Tiled floor panels
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
      if ((r + c) % 2 === 0) this.fillRect(rg, 0x0d1220, c * T, r * T, T, T);
    }
    // Subtle grid lines
    rg.lineStyle(1, 0x1a2a3a, 0.4);
    for (let r = 0; r <= MH; r++) { rg.moveTo(0, r * T); rg.lineTo(WORLD_W, r * T); }
    for (let c = 0; c <= MW; c++) { rg.moveTo(c * T, 0); rg.lineTo(c * T, WORLD_H); }
    rg.strokePath();

    // Giant main screen wall (top)
    const scrY = T * 2, scrH = T * 12;
    this.fillRect(rg, 0x020820, 0, scrY, WORLD_W, scrH);
    rg.lineStyle(4, 0x00d4ff, 0.9); rg.strokeRect(T * 2, scrY + T, WORLD_W - T * 4, scrH - T * 2);
    // Screen content — world map grid
    rg.lineStyle(1, 0x003355, 0.6);
    for (let i = 0; i < 20; i++) {
      rg.moveTo(T * 2, scrY + T + i * T * 0.5); rg.lineTo(WORLD_W - T * 2, scrY + T + i * T * 0.5);
      rg.moveTo(T * 2 + i * T * 3.8, scrY + T); rg.lineTo(T * 2 + i * T * 3.8, scrY + scrH - T);
    }
    rg.strokePath();
    // Blips on screen
    [[WORLD_W*0.25,scrY+scrH*0.4],[WORLD_W*0.5,scrY+scrH*0.6],[WORLD_W*0.7,scrY+scrH*0.3],[WORLD_W*0.85,scrY+scrH*0.5]].forEach(([bx,by]) => {
      this.circle(rg, 0x00ff88, bx, by, 5, 0.9);
      rg.lineStyle(1, 0x00ff88, 0.3); rg.strokeCircle(bx, by, 14);
    });
    // Screen labels
    this.addWall(0, scrY, WORLD_W, T);
    this.addWall(0, scrY + scrH, WORLD_W, T);

    // Operator rows — tiered workstations
    const rowStart = scrY + scrH + T * 2;
    for (let row = 0; row < 4; row++) {
      const ry = rowStart + row * T * 4;
      this.fillRect(rg, 0x0a1428, T * 2, ry, WORLD_W - T * 4, T * 3);
      rg.lineStyle(2, 0x1a3a5a, 0.8); rg.strokeRect(T * 2, ry, WORLD_W - T * 4, T * 3);
      // Individual stations
      for (let col = 0; col < 8; col++) {
        const cx = T * 3 + col * T * 9.5;
        // Desk surface
        this.fillRect(rg, C.DESK_SPACE, cx, ry + T * 0.5, T * 7, T * 1.2);
        // Monitor glow
        this.fillRect(rg, 0x001a33, cx + T * 0.5, ry + T * 0.2, T * 2.5, T * 1.5);
        this.fillRect(rg, 0x002244, cx + T * 3.5, ry + T * 0.2, T * 2.5, T * 1.5);
        rg.lineStyle(1, C.DESK_SPACE_GL, 0.6);
        rg.strokeRect(cx + T * 0.5, ry + T * 0.2, T * 2.5, T * 1.5);
        rg.strokeRect(cx + T * 3.5, ry + T * 0.2, T * 2.5, T * 1.5);
      }
      this.addWall(T * 2, ry, WORLD_W - T * 4, T * 0.5);
    }

    // Side status panels
    [[0,T*2],[WORLD_W-T*2,T*2]].forEach(([px,_py]) => {
      for (let i = 0; i < 6; i++) {
        const py2 = rowStart + i * T * 4;
        this.fillRect(rg, 0x0a1428, px, py2, T * 2, T * 3);
        this.circle(rg, i % 3 === 0 ? 0x00ff88 : i % 3 === 1 ? 0xff3344 : 0x0088ff, px + T, py2 + T * 1.5, 8, 0.9);
      }
    });
  }

  // ─── Space Lab ───────────────────────────────────────────────
  private drawLab(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    this.fillRect(rg, 0x0c0c18, 0, 0, WORLD_W, WORLD_H);

    // Tiled white lab floor
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
      const col = (r + c) % 2 === 0 ? 0x1a1a28 : 0x161620;
      this.fillRect(rg, col, c * T, r * T, T, T);
    }

    // Outer walls
    this.addWall(0, 0, WORLD_W, T);
    this.addWall(0, WORLD_H - T, WORLD_W, T);
    this.addWall(0, 0, T, WORLD_H);
    this.addWall(WORLD_W - T, 0, T, WORLD_H);
    this.fillRect(rg, 0x1e1e2e, 0, 0, T, WORLD_H);
    this.fillRect(rg, 0x1e1e2e, WORLD_W - T, 0, T, WORLD_H);

    // Lab benches — long horizontal
    const bench = (bx: number, by: number, w: number) => {
      this.fillRect(rg, 0x1a2a3a, bx, by, w, T * 1.5);
      rg.lineStyle(2, 0x3a5a7a, 0.8); rg.strokeRect(bx, by, w, T * 1.5);
      this.addWall(bx, by, w, T * 0.5);
      // Equipment on bench
      for (let e = 0; e < Math.floor(w / (T * 3)); e++) {
        const ex = bx + T + e * T * 3;
        this.circle(rg, 0x9b30ff, ex, by + T * 0.8, 10, 0.7);  // flask
        this.fillRect(rg, 0x003355, ex + T * 1.3, by + T * 0.3, T * 1.2, T); // display
        rg.lineStyle(1, 0x00d4ff, 0.5); rg.strokeRect(ex + T * 1.3, by + T * 0.3, T * 1.2, T);
      }
    };

    for (let row = 0; row < 5; row++) bench(T * 2, T * (4 + row * 8), T * 50);
    for (let row = 0; row < 5; row++) bench(T * 55, T * (4 + row * 8), T * 22);

    // Centrifuge / reactor chamber
    const cX = WORLD_W * 0.75, cY = WORLD_H * 0.5;
    this.circle(rg, 0x0a0a18, cX, cY, T * 5, 0.95);
    rg.lineStyle(6, 0x9b30ff, 0.8); rg.strokeCircle(cX, cY, T * 5);
    rg.lineStyle(3, 0x9b30ff, 0.4); rg.strokeCircle(cX, cY, T * 4);
    rg.lineStyle(2, 0x9b30ff, 0.2); rg.strokeCircle(cX, cY, T * 3);
    this.circle(rg, 0x6600cc, cX, cY, T * 2, 0.7);
    // Rotating spokes (static)
    rg.lineStyle(3, 0xaa00ff, 0.6);
    for (let a = 0; a < 6; a++) {
      const angle = (a / 6) * Math.PI * 2;
      rg.moveTo(cX, cY);
      rg.lineTo(cX + Math.cos(angle) * T * 4.5, cY + Math.sin(angle) * T * 4.5);
    }
    rg.strokePath();

    // Cryogenic pods along right wall
    for (let i = 0; i < 6; i++) {
      const px = WORLD_W - T * 5, py = T * (3 + i * 7);
      this.fillRect(rg, 0x0a1a2a, px, py, T * 3, T * 5);
      rg.lineStyle(3, 0x00d4ff, 0.8); rg.strokeRect(px, py, T * 3, T * 5);
      this.circle(rg, 0x003355, px + T * 1.5, py + T * 2, T * 1.2, 0.6);
      rg.lineStyle(2, 0x00d4ff, 0.3); rg.strokeCircle(px + T * 1.5, py + T * 2, T * 1.2);
    }
  }

  // ─── Hangar ──────────────────────────────────────────────────
  private drawHangar(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    // Concrete hangar floor
    this.fillRect(rg, 0x1a1a1e, 0, 0, WORLD_W, WORLD_H);
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
      if ((r % 4 === 0) || (c % 4 === 0)) this.fillRect(rg, 0x222228, c * T, r * T, T, T);
    }

    // Floor markings — yellow lane lines
    rg.lineStyle(4, 0xffd700, 0.7);
    for (let i = 1; i < 5; i++) {
      rg.moveTo(0, WORLD_H * (i / 5)); rg.lineTo(WORLD_W, WORLD_H * (i / 5));
    }
    rg.strokePath();
    rg.lineStyle(4, 0xffd700, 0.7);
    rg.moveTo(WORLD_W / 2, 0); rg.lineTo(WORLD_W / 2, WORLD_H);
    rg.strokePath();

    // Parked spaceships (3 big ones)
    const ship = (sx: number, sy: number, scale: number = 1) => {
      const w = T * 8 * scale, h = T * 4 * scale;
      // Hull
      this.fillRect(rg, 0x2a3a4a, sx - w / 2, sy - h / 2, w, h);
      rg.lineStyle(3, 0x4a6a8a, 1); rg.strokeRect(sx - w / 2, sy - h / 2, w, h);
      // Cockpit
      this.circle(rg, 0x3a6a9a, sx - w * 0.35, sy, h * 0.4, 0.9);
      rg.lineStyle(2, 0x70c0f0, 0.7); rg.strokeCircle(sx - w * 0.35, sy, h * 0.4);
      // Engine pods
      [[sx + w * 0.35, sy - h * 0.4],[sx + w * 0.35, sy + h * 0.4]].forEach(([ex,ey]) => {
        this.circle(rg, 0xff6b35, ex, ey, h * 0.25, 0.8);
        this.circle(rg, 0xff8c42, ex, ey, h * 0.15, 0.9);
      });
      // Landing struts
      [[sx - w * 0.2, sy + h / 2],[sx + w * 0.2, sy + h / 2]].forEach(([lx,ly]) => {
        rg.lineStyle(4, 0x3a3a4a, 1); rg.moveTo(lx, ly); rg.lineTo(lx, ly + T * 1.5 * scale); rg.strokePath();
        this.circle(rg, 0x2a2a2a, lx, ly + T * 1.5 * scale, T * 0.6 * scale, 1);
      });
    };
    ship(WORLD_W * 0.25, WORLD_H * 0.2);
    ship(WORLD_W * 0.75, WORLD_H * 0.2);
    ship(WORLD_W * 0.5,  WORLD_H * 0.55, 1.5);

    // Tool racks and crates along walls
    for (let i = 0; i < 10; i++) {
      const cx = T * (3 + i * 7), cy = T * 2;
      this.fillRect(rg, 0x3a3a42, cx, cy, T * 3, T * 2);
      rg.lineStyle(2, 0xffd700, 0.5); rg.strokeRect(cx, cy, T * 3, T * 2);
    }
    for (let i = 0; i < 10; i++) {
      const cx = T * (3 + i * 7), cy = WORLD_H - T * 3;
      this.fillRect(rg, 0x3a3a42, cx, cy, T * 3, T * 2);
      rg.lineStyle(2, 0xffd700, 0.5); rg.strokeRect(cx, cy, T * 3, T * 2);
    }
    this.addWall(0, 0, WORLD_W, T * 2);
    this.addWall(0, WORLD_H - T * 2, WORLD_W, T * 2);

    // Giant hangar doors (top)
    const doorW = WORLD_W * 0.6, doorX = (WORLD_W - doorW) / 2;
    rg.lineStyle(8, 0x4a5a6a, 1);
    for (let seg = 0; seg < 8; seg++) {
      const sx2 = doorX + seg * (doorW / 8);
      rg.moveTo(sx2, 0); rg.lineTo(sx2, T * 2);
    }
    rg.strokePath();
  }

  // ─── Mars Colony ─────────────────────────────────────────────
  private drawMars(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    // Rust-red Mars sky
    this.fillRect(rg, 0x3a1005, 0, 0, WORLD_W, T * 10);
    // Ground
    this.fillRect(rg, 0x5a2010, 0, T * 10, WORLD_W, WORLD_H - T * 10);
    // Ground texture — random darker patches
    const gr = this.add.graphics().setDepth(1);
    for (let i = 0; i < 120; i++) {
      const rx = Math.random() * WORLD_W, ry = T * 10 + Math.random() * (WORLD_H - T * 10);
      gr.fillStyle(0x4a1808, 0.5);
      gr.fillEllipse(rx, ry, Math.random() * T * 4 + T, Math.random() * T + T * 0.5);
    }
    // Rocky outcrops
    [[T*10,T*14,45],[T*30,T*28,60],[T*50,T*18,35],[T*65,T*32,50],[T*72,T*15,40]].forEach(([rx,ry,r]) => {
      this.circle(rg, 0x6a2a10, rx, ry, r, 0.9);
      this.circle(rg, 0x7a3a18, rx - r * 0.2, ry - r * 0.3, r * 0.5, 0.7);
    });

    // Dust storm on horizon
    rg.fillStyle(0xc06030, 0.15);
    rg.fillRect(0, T * 8, WORLD_W, T * 4);

    // Colony domes
    const dome = (dx: number, dy: number, r: number, col: number = 0x1a2a3a) => {
      this.circle(rg, col, dx, dy, r, 0.92);
      rg.lineStyle(4, 0x4a8abb, 0.7); rg.strokeCircle(dx, dy, r);
      rg.lineStyle(2, 0x70c0f0, 0.3); rg.strokeCircle(dx, dy, r - 6);
      this.fillRect(rg, 0x7a3020, dx - r, dy + 1, r * 2, T); // foundation
    };
    dome(WORLD_W * 0.3, T * 18, 100);
    dome(WORLD_W * 0.5, T * 14, 70, 0x1a1a2a);
    dome(WORLD_W * 0.7, T * 22, 85);
    dome(WORLD_W * 0.15, T * 24, 55, 0x1a2010);

    // Habitat tubes connecting domes
    rg.fillStyle(0x1e2e3e, 0.9);
    rg.fillRect(WORLD_W * 0.3 + 100, T * 17, WORLD_W * 0.2 - 100, T * 2);
    rg.fillRect(WORLD_W * 0.5 + 70, T * 17, WORLD_W * 0.2 - 70, T * 2);
    rg.lineStyle(2, 0x4a8abb, 0.5);
    rg.strokeRect(WORLD_W * 0.3 + 100, T * 17, WORLD_W * 0.2 - 100, T * 2);

    // Mars rover tracks
    rg.lineStyle(3, 0x7a3a20, 0.6);
    rg.moveTo(T * 5, T * 40); rg.lineTo(T * 40, T * 20); rg.lineTo(T * 60, T * 35);
    rg.strokePath();

    // Flags
    [[WORLD_W * 0.3, T * 11],[WORLD_W * 0.5, T * 10],[WORLD_W * 0.7, T * 12]].forEach(([fx,fy]) => {
      rg.lineStyle(3, 0xdddddd, 1); rg.moveTo(fx, fy); rg.lineTo(fx, fy + T * 3); rg.strokePath();
      this.fillRect(rg, 0xff4444, fx, fy, T * 2, T);
    });

    // Solar arrays
    for (let i = 0; i < 5; i++) {
      const px = T * (5 + i * 15), py = T * 12;
      this.fillRect(rg, 0x1a3a5a, px, py, T * 4, T * 1.5);
      rg.lineStyle(1, 0x3a7aaa, 0.7);
      for (let d = 1; d < 4; d++) { rg.moveTo(px + T * d, py); rg.lineTo(px + T * d, py + T * 1.5); }
      rg.strokePath();
    }

    this.addWall(0, T * 10, WORLD_W, T);
  }

  // ─── Observatory ─────────────────────────────────────────────
  private drawObservatory(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    // Night sky
    this.fillRect(rg, 0x010108, 0, 0, WORLD_W, WORLD_H);
    // Dense star field
    const sg = this.add.graphics().setDepth(0);
    for (let i = 0; i < 400; i++) {
      const alpha = Math.random() * 0.8 + 0.2;
      const size  = Math.random() * 1.5 + 0.3;
      sg.fillStyle(0xffffff, alpha);
      sg.fillCircle(Math.random() * WORLD_W, Math.random() * WORLD_H * 0.6, size);
    }
    // Milky Way band
    for (let i = 0; i < 300; i++) {
      const bx = Math.random() * WORLD_W;
      const by = WORLD_H * 0.1 + Math.sin(bx / WORLD_W * Math.PI) * WORLD_H * 0.15 + Math.random() * T * 4 - T * 2;
      sg.fillStyle(0xffffff, Math.random() * 0.3 + 0.05);
      sg.fillCircle(bx, by, Math.random() * 1.2 + 0.2);
    }
    // Nebula
    rg.fillStyle(0x3a0a60, 0.15); rg.fillCircle(WORLD_W * 0.3, WORLD_H * 0.2, 200);
    rg.fillStyle(0x0a1a60, 0.15); rg.fillCircle(WORLD_W * 0.7, WORLD_H * 0.15, 150);

    // Ground — hill silhouette
    const hillY = WORLD_H * 0.6;
    this.fillRect(rg, 0x0a0a10, 0, hillY, WORLD_W, WORLD_H - hillY);

    // Main observatory dome
    const obsX = WORLD_W / 2, obsY = hillY;
    this.circle(rg, 0x1a1a28, obsX, obsY, 140, 0.97);
    rg.lineStyle(5, 0xaaaacc, 0.8); rg.strokeCircle(obsX, obsY, 140);
    // Dome slit
    rg.lineStyle(8, 0x050510, 1);
    rg.moveTo(obsX, obsY - 140); rg.lineTo(obsX, obsY + 10); rg.strokePath();
    // Telescope barrel
    this.fillRect(rg, 0x2a2a3e, obsX - T * 0.5, obsY - T * 5, T, T * 5);
    this.circle(rg, 0x3a3a50, obsX, obsY - T * 4.5, T * 0.8, 1);
    rg.lineStyle(3, 0xaaaacc, 0.5); rg.strokeCircle(obsX, obsY - T * 4.5, T * 0.8);

    // Building base
    this.fillRect(rg, 0x151520, obsX - T * 5, hillY, T * 10, T * 4);
    rg.lineStyle(3, 0x3a3a50, 0.8); rg.strokeRect(obsX - T * 5, hillY, T * 10, T * 4);
    this.addWall(obsX - T * 5, hillY + T * 3, T * 10, T);

    // Side buildings — control room + housing
    [[obsX - T * 14, hillY + T],[obsX + T * 7, hillY + T]].forEach(([bx,by]) => {
      this.fillRect(rg, 0x111118, bx, by, T * 7, T * 5);
      rg.lineStyle(2, 0x2a2a40, 0.8); rg.strokeRect(bx, by, T * 7, T * 5);
      // Lit windows
      for (let w = 0; w < 2; w++) {
        this.fillRect(rg, 0x302820, bx + T + w * T * 3, by + T, T * 1.5, T * 1.2);
        rg.lineStyle(1, 0xffa040, 0.7); rg.strokeRect(bx + T + w * T * 3, by + T, T * 1.5, T * 1.2);
      }
    });

    // Satellite dishes
    [[obsX - T * 20, hillY - T],[obsX + T * 18, hillY - T]].forEach(([dx,dy]) => {
      rg.lineStyle(3, 0x4a4a60, 1); rg.moveTo(dx, dy); rg.lineTo(dx, dy + T * 2); rg.strokePath();
      rg.lineStyle(2, 0x6a6a80, 0.8); rg.strokeCircle(dx, dy - T * 0.5, T * 1.5);
      rg.lineStyle(1, 0x6a6a80, 0.4); rg.strokeCircle(dx, dy - T * 0.5, T);
    });

    // Path up the hill
    rg.lineStyle(T * 1.5, 0x181820, 0.8);
    rg.moveTo(obsX, hillY + T * 4); rg.lineTo(obsX - T * 10, WORLD_H);
    rg.moveTo(obsX, hillY + T * 4); rg.lineTo(obsX + T * 10, WORLD_H);
    rg.strokePath();
  }

  // ─── Starship Bridge ─────────────────────────────────────────
  private drawBridge(this: Phaser.Scene & WorldScene) {
    const rg = this.add.graphics().setDepth(1);
    this.fillRect(rg, 0x06080e, 0, 0, WORLD_W, WORLD_H);

    // Hull plating tiles
    for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
      const col = ((r + c) % 6 < 1) ? 0x141820 : ((r % 4 === 0 || c % 4 === 0) ? 0x0e1218 : 0x0a0c10);
      this.fillRect(rg, col, c * T, r * T, T, T);
    }
    // Accent lines
    rg.lineStyle(2, 0x003355, 0.5);
    for (let r = 0; r <= MH; r += 4) { rg.moveTo(0, r * T); rg.lineTo(WORLD_W, r * T); }
    for (let c = 0; c <= MW; c += 4) { rg.moveTo(c * T, 0); rg.lineTo(c * T, WORLD_H); }
    rg.strokePath();

    // Forward viewport — massive panoramic window
    const vpY = T * 2, vpH = T * 14;
    this.fillRect(rg, 0x010510, T * 2, vpY, WORLD_W - T * 4, vpH);
    rg.lineStyle(6, 0x2a5a8a, 1); rg.strokeRect(T * 2, vpY, WORLD_W - T * 4, vpH);
    // Window frame struts
    rg.lineStyle(4, 0x1a2a3a, 1);
    for (let i = 1; i < 6; i++) { rg.moveTo(WORLD_W * (i / 6), vpY); rg.lineTo(WORLD_W * (i / 6), vpY + vpH); }
    rg.strokePath();
    // Stars outside window
    const wsg = this.add.graphics().setDepth(2);
    for (let i = 0; i < 250; i++) {
      wsg.fillStyle(0xffffff, Math.random() * 0.8 + 0.2);
      wsg.fillCircle(T * 2 + Math.random() * (WORLD_W - T * 4), vpY + Math.random() * vpH, Math.random() * 1.5 + 0.3);
    }
    // Planet visible through window
    this.circle(wsg, 0x4a2aa0, WORLD_W * 0.75, vpY + vpH * 0.55, 120, 0.7);
    this.circle(wsg, 0x6a4ac0, WORLD_W * 0.78, vpY + vpH * 0.45, 50, 0.5);
    // Planet rings
    wsg.lineStyle(6, 0x8a6ae0, 0.35);
    wsg.strokeEllipse(WORLD_W * 0.75, vpY + vpH * 0.55, 320, 40);

    // Warp streaks
    wsg.lineStyle(1, 0xffffff, 0.15);
    for (let i = 0; i < 30; i++) {
      const wx = Math.random() * (WORLD_W - T * 4) + T * 2;
      const wy = vpY + Math.random() * vpH;
      const len = Math.random() * T * 3 + T;
      wsg.moveTo(wx, wy); wsg.lineTo(wx + len, wy + len * 0.3); wsg.strokePath();
    }

    this.addWall(0, vpY, WORLD_W, T);
    this.addWall(0, vpY + vpH, WORLD_W, T);

    // Captain's chair — center raised platform
    const platY = vpY + vpH + T * 2;
    this.fillRect(rg, 0x0e1420, T * 20, platY, T * 40, T * 6);
    rg.lineStyle(3, 0x2a4a6a, 0.9); rg.strokeRect(T * 20, platY, T * 40, T * 6);
    // Chair
    this.circle(rg, 0x1a1a2e, WORLD_W / 2, platY + T * 3, T * 2, 0.9);
    rg.lineStyle(2, 0x00d4ff, 0.6); rg.strokeCircle(WORLD_W / 2, platY + T * 3, T * 2);
    this.fillRect(rg, 0x0a0a18, WORLD_W / 2 - T, platY + T, T * 2, T * 4); // back
    // Armrest consoles
    [[WORLD_W / 2 - T * 3, platY + T * 2],[WORLD_W / 2 + T * 1.5, platY + T * 2]].forEach(([ax,ay]) => {
      this.fillRect(rg, 0x0e1e2e, ax, ay, T * 1.5, T * 2);
      this.fillRect(rg, 0x003344, ax + T * 0.2, ay + T * 0.3, T, T * 0.8);
      rg.lineStyle(1, 0x00d4ff, 0.5); rg.strokeRect(ax + T * 0.2, ay + T * 0.3, T, T * 0.8);
    });

    // Helm / nav console
    const helmY = platY + T * 7;
    this.fillRect(rg, 0x0a1428, T * 25, helmY, T * 30, T * 3);
    rg.lineStyle(3, 0x00d4ff, 0.7); rg.strokeRect(T * 25, helmY, T * 30, T * 3);
    for (let b = 0; b < 12; b++) {
      const bx = T * 26 + b * T * 2.3;
      this.fillRect(rg, 0x001a33, bx, helmY + T * 0.5, T * 2, T * 1.5);
      rg.lineStyle(1, 0x0088ff, 0.4); rg.strokeRect(bx, helmY + T * 0.5, T * 2, T * 1.5);
    }
    this.addWall(T * 25, helmY, T * 30, T * 0.5);

    // Side tactical stations
    [[T * 2, platY],[WORLD_W - T * 12, platY]].forEach(([sx,sy]) => {
      this.fillRect(rg, 0x0a1420, sx, sy, T * 10, T * 8);
      rg.lineStyle(2, 0x1a3a5a, 0.8); rg.strokeRect(sx, sy, T * 10, T * 8);
      for (let sc = 0; sc < 3; sc++) {
        this.fillRect(rg, 0x001a33, sx + T + sc * T * 3, sy + T, T * 2, T * 2);
        rg.lineStyle(1, 0x0088ff, 0.4); rg.strokeRect(sx + T + sc * T * 3, sy + T, T * 2, T * 2);
      }
      this.addWall(sx, sy, T * 10, T);
    });

    // Engine status displays (bottom)
    const engY = WORLD_H - T * 8;
    this.fillRect(rg, 0x0e0e18, 0, engY, WORLD_W, T * 8);
    this.addWall(0, engY, WORLD_W, T);
    rg.lineStyle(3, 0x2a2a3a, 0.8); rg.strokeRect(0, engY, WORLD_W, T * 8);
    for (let i = 0; i < 8; i++) {
      const ex = T * (4 + i * 9);
      this.fillRect(rg, 0x0a1820, ex, engY + T, T * 6, T * 5);
      rg.lineStyle(2, 0x00d4ff, 0.4); rg.strokeRect(ex, engY + T, T * 6, T * 5);
      // Engine bar graphs
      const barH = Math.random() * T * 3 + T;
      this.fillRect(rg, 0x00d4ff, ex + T, engY + T * 6 - barH, T * 0.8, barH);
      this.fillRect(rg, 0x0088ff, ex + T * 2.2, engY + T * 6 - barH * 0.8, T * 0.8, barH * 0.8);
      this.fillRect(rg, 0x00ff88, ex + T * 3.4, engY + T * 6 - barH * 0.6, T * 0.8, barH * 0.6);
      this.fillRect(rg, 0xff3344, ex + T * 4.6, engY + T * 6 - barH * 0.4, T * 0.8, barH * 0.4);
    }
  }

  // ─── Player textures ──────────────────────────────────────────

  /**
   * Builds three animated astronaut textures on transparent HTML5 canvases.
   * Body is drawn with pixel-art shapes (legs animate per frame).
   * Profile photo (or skin tone) is composited into the face circle.
   */
  // ─── LPC Spritesheet loader ───────────────────────────────────
  /**
   * Loads a Universal LPC spritesheet from URL, registers Phaser animations
   * (walk_down / walk_up / walk_left / walk_right / idle_<dir>) and creates
   * the physics sprite that replaces the static canvas-based player.
   */
  private loadLpcSpritesheet(this: Phaser.Scene & WorldScene, url: string, startX: number, startY: number) {
    const KEY = "__lpc_sheet__";

    // Pipoya format: 96×128px spritesheet → 32×32 per frame, 3 cols × 4 rows
    // rows: 0=down, 1=left, 2=right, 3=up  |  walk cols: 0,1,2
    // LPC format: frameWidth=64, rows 8-11, 9 cols per row
    const isPipoya = (frameW: number) => frameW === 32;

    const setupSprite = (frameW: number) => {
      if (this.lpcSprite) return;

      const pipoya = isPipoya(frameW);

      type Dir = "down"|"up"|"left"|"right";
      const dirs: Array<{ dir: Dir; row: number }> = pipoya
        ? [
            { dir: "down",  row: 0 },
            { dir: "left",  row: 1 },
            { dir: "right", row: 2 },
            { dir: "up",    row: 3 },
          ]
        : [
            { dir: "down",  row: LPC_WALK_ROWS.down  },
            { dir: "up",    row: LPC_WALK_ROWS.up    },
            { dir: "left",  row: LPC_WALK_ROWS.left  },
            { dir: "right", row: LPC_WALK_ROWS.right },
          ];

      const cols = pipoya ? 3 : LPC_WALK_FRAMES; // frames per row

      for (const { dir, row } of dirs) {
        const walkKey = `lpc_walk_${dir}`;
        const idleKey = `lpc_idle_${dir}`;

        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: Array.from({ length: pipoya ? 3 : 8 }, (_, i) => ({
              key: KEY,
              frame: pipoya ? row * cols + i : row * cols + 1 + i,
            })),
            frameRate: pipoya ? 8 : 10,
            repeat: -1,
          });
        }

        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [{ key: KEY, frame: pipoya ? row * cols + 1 : row * cols }],
            frameRate: 1,
            repeat: -1,
          });
        }
      }

      // Base scale por formato + multiplicador do usuário (avatarScale)
      const baseScale  = pipoya ? 1.5 : LPC_SCALE;
      const userScale  = this.clampAvatarScale(
        (this.avatarConfig as AvatarConfig | undefined)?.avatarScale ?? 1,
      );
      const scale = baseScale * userScale;

      const sprite = this.physics.add.sprite(startX, startY, KEY)
        .setScale(scale)
        .setDepth(20)
        .setCollideWorldBounds(true);

      // Salva o baseScale e isPipoya pra poder reescalar depois sem recriar o sprite
      sprite.setData("baseScale", baseScale);
      sprite.setData("isPipoya",  pipoya);

      const body = sprite.body as Phaser.Physics.Arcade.Body;
      if (pipoya) {
        body.setSize(20, 28).setOffset(6, 4);
      } else {
        body.setSize(24, 40).setOffset(20, 22);
      }

      this.lpcSprite = sprite;
      this.physics.add.collider(this.lpcSprite, this.walls);
      this.cameras.main.startFollow(this.lpcSprite, true, 0.1, 0.1);
      this.cameras.main.setZoom(this.currentZoom);
      this.lpcSprite.anims.play("lpc_idle_down");

      // Broadcast initial position so others can see us immediately
      window.dispatchEvent(new CustomEvent("space-station:player-moved", {
        detail: { x: startX, y: startY },
      }));
    };

    // Always remove cached texture so new game instances load fresh
    if (this.textures.exists(KEY)) {
      this.textures.remove(KEY);
    }

    const PIXEL_ASTRONAUT_BASE = "/lpc_pixel_astronaut.png";
    const isPixelAstronaut = url === "pixel_astronaut";
    const profileUrl = (this.avatarConfig as AvatarConfig & { _photoUrl?: string })?._photoUrl;

    const isAlive = () => this.scene?.isActive?.() ?? !(this.game as Phaser.Game & { isDestroyed?: boolean })?.isDestroyed;

    // Overlays from AvatarConfig — composited on top of the base spritesheet
    // before registering with Phaser. Works for both Pipoya (32×32) and LPC
    // (64×64) bases; buildCompositeSpritesheet scales mismatched overlays.
    const ac = this.avatarConfig as (AvatarConfig & {
      wokaEyesUrl?: string | null; wokaHairUrl?: string | null;
      wokaClothesUrl?: string | null; wokaHatUrl?: string | null;
      wokaAccessoryUrl?: string | null;
    }) | undefined;

    const applyCompositeToTexture = (canvas: HTMLCanvasElement) => {
      if (!isAlive()) return;
      const frameW = canvas.width <= 96 ? 32 : LPC_FRAME;
      const cols = Math.floor(canvas.width  / frameW);
      const rows = Math.floor(canvas.height / frameW);
      if (!this.textures.exists(KEY)) {
        this.textures.addSpriteSheet(KEY, canvas as unknown as HTMLImageElement, {
          frameWidth: frameW, frameHeight: frameW,
          startFrame: 0, endFrame: cols * rows - 1,
        });
      }
      setupSprite(frameW);
    };

    const handleLoadError = () => {
      if (!isAlive()) return;
      console.warn("[WorldScene] Failed to load spritesheet:", url);
      const canvas = document.createElement("canvas");
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = (this.avatarConfig?.suitColor ?? "#7c3aed");
      ctx.fillRect(6, 8, 20, 24);
      ctx.fillStyle = (this.avatarConfig?.skinTone ?? "#FFDBB4");
      ctx.beginPath(); ctx.arc(16, 10, 8, 0, Math.PI * 2); ctx.fill();
      if (!this.textures.exists(KEY)) this.textures.addCanvas(KEY, canvas);
      setupSprite(32);
    };

    const loadFromUrl = (resolvedUrl: string) => {
      const hasOverlays = !!(ac?.wokaEyesUrl || ac?.wokaHairUrl ||
                             ac?.wokaClothesUrl || ac?.wokaHatUrl ||
                             ac?.wokaAccessoryUrl);

      // Fast path: no overlays → use the original single-image loader
      if (!hasOverlays) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (!isAlive()) return;
          const canvas = document.createElement("canvas");
          canvas.width  = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          applyCompositeToTexture(canvas);
          if (resolvedUrl.startsWith("blob:")) URL.revokeObjectURL(resolvedUrl);
        };
        img.onerror = handleLoadError;
        img.src = resolvedUrl;
        return;
      }

      // Slow path: build composite with overlays
      buildCompositeSpritesheet({
        base:      resolvedUrl,
        eyes:      ac?.wokaEyesUrl,
        hair:      ac?.wokaHairUrl,
        clothes:   ac?.wokaClothesUrl,
        hat:       ac?.wokaHatUrl,
        accessory: ac?.wokaAccessoryUrl,
      }).then((canvas) => {
        if (!canvas) { handleLoadError(); return; }
        applyCompositeToTexture(canvas);
        if (resolvedUrl.startsWith("blob:")) URL.revokeObjectURL(resolvedUrl);
      });
    };

    if (isPixelAstronaut) {
      buildVisorSpritesheet(PIXEL_ASTRONAUT_BASE, profileUrl)
        .then(loadFromUrl)
        .catch(() => loadFromUrl(PIXEL_ASTRONAUT_BASE));
    } else {
      loadFromUrl(url);
    }
  }

  private generatePlayerTextures(this: Phaser.Scene & WorldScene) {
    const cfg       = this.avatarConfig;
    const suitHex   = cfg?.suitColor   ?? "#3b6fd4";
    const helmHex   = cfg?.helmetColor ?? "#06b6d4";
    const skinHex   = cfg?.skinTone    ?? "#FFDBB4";
    const hairHex   = cfg?.hairColor   ?? "#3B2A1E";
    const acc       = cfg?.accessory   ?? "none";
    const photoUrl  = cfg?.useProfilePhoto
      ? (cfg as AvatarConfig & { _photoUrl?: string })._photoUrl
      : undefined;

    // ── SVG-based texture generation ──────────────────────────────────────────
    // Each frame SVG has named <g id="..."> groups with a fill attribute.
    // We replace the fill color for each group to apply the avatar config.
    const colorMap: Record<string, string> = {
      "suit":      suitHex,
      "suit-arms": suitHex,
      "suit-legs": suitHex,
      "helmet":    helmHex,
      "visor":     "#1B2A4A",
      "face":      skinHex,
      "hair":      hairHex,
      "beard":     hairHex,
      "gloves":    "#1A2A3A",
      "boots":     "#1C2A36",
      "backpack":  "#2A3F60",
      "detail":    "#FFFFFF",
    };

    const recolorSvg = (svgText: string): string => {
      let out = svgText;
      for (const [id, color] of Object.entries(colorMap)) {
        // Replace: <g id="suit" fill="#...">  →  <g id="suit" fill="<newColor>">
        out = out.replace(
          new RegExp(`(<g id="${id}"[^>]*fill=")[^"]*(")`,"g"),
          `$1${color}$2`
        );
      }
      return out;
    };

    const FRAME_FILES: { key: string; file: string }[] = [
      { key: "__player_idle__",   file: "/astronaut-idle.svg"   },
      { key: "__player_walk_a__", file: "/astronaut-walk_a.svg" },
      { key: "__player_walk_b__", file: "/astronaut-walk_b.svg" },
    ];

    const W = 32, H = 54;
    const SVG_W = 320, SVG_H = 540;

    const loadSvgFrame = (frameKey: string, svgText: string, photo?: HTMLImageElement | null) => {
      const colored = recolorSvg(svgText);
      const blob    = new Blob([colored], { type: "image/svg+xml" });
      const url     = URL.createObjectURL(blob);

      const svgImg = new Image(SVG_W, SVG_H);
      svgImg.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d")!;

        // Draw scaled SVG onto small canvas (crisp pixels)
        ctx.drawImage(svgImg, 0, 0, SVG_W, SVG_H, 0, 0, W, H);

        // Composite profile photo into face circle
        if (photo) {
          const HX = 16, HY = 11, HR = 9;
          ctx.save();
          ctx.beginPath();
          ctx.arc(HX, HY, HR, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(photo, HX - HR, HY - HR, HR * 2, HR * 2);
          ctx.restore();
        }

        URL.revokeObjectURL(url);
        if ((this as unknown as Phaser.Scene).textures?.exists(frameKey)) {
          (this as unknown as Phaser.Scene).textures.remove(frameKey);
        }
        (this as unknown as Phaser.Scene).textures.addCanvas(frameKey, canvas);

        // Refresh player sprite if already created
        const scene = this as unknown as Phaser.Scene & WorldScene;
        if (scene.player && scene.player.texture.key !== frameKey) {
          // player is live — force texture refresh on idle frame
          if (frameKey === "__player_idle__") {
            scene.player.setTexture("__player_idle__");
          }
        }
      };
      svgImg.onerror = () => {
        URL.revokeObjectURL(url);
        // Fall back to solid-color canvas
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = suitHex;
        ctx.fillRect(0, 16, W, H - 16);
        ctx.fillStyle = skinHex;
        ctx.beginPath(); ctx.arc(W/2, 11, 9, 0, Math.PI*2); ctx.fill();
        if ((this as unknown as Phaser.Scene).textures?.exists(frameKey)) {
          (this as unknown as Phaser.Scene).textures.remove(frameKey);
        }
        (this as unknown as Phaser.Scene).textures.addCanvas(frameKey, canvas);
      };
      svgImg.src = url;
    };

    const loadAll = (photo?: HTMLImageElement | null) => {
      for (const { key, file } of FRAME_FILES) {
        fetch(file)
          .then(res => res.text())
          .then(text => loadSvgFrame(key, text, photo))
          .catch(() => {
            // file not found — build minimal fallback immediately
            const canvas = document.createElement("canvas");
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = suitHex;
            ctx.fillRect(0, 16, W, H - 16);
            ctx.fillStyle = skinHex;
            ctx.beginPath(); ctx.arc(W/2, 11, 9, 0, Math.PI*2); ctx.fill();
            if ((this as unknown as Phaser.Scene).textures?.exists(key)) {
              (this as unknown as Phaser.Scene).textures.remove(key);
            }
            (this as unknown as Phaser.Scene).textures.addCanvas(key, canvas);
          });
      }
    };

    // Build placeholder textures synchronously so player sprite exists immediately
    for (const { key } of FRAME_FILES) {
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = suitHex;
      ctx.fillRect(4, 16, W - 8, H - 20);
      ctx.fillStyle = skinHex;
      ctx.beginPath(); ctx.arc(W/2, 11, 9, 0, Math.PI*2); ctx.fill();
      if (!(this as unknown as Phaser.Scene).textures.exists(key)) {
        (this as unknown as Phaser.Scene).textures.addCanvas(key, canvas);
      }
    }

    // Then asynchronously load real SVG textures (with optional photo)
    if (photoUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => loadAll(img);
      img.onerror = () => loadAll(null);
      img.src = photoUrl;
    } else {
      loadAll(null);
    }

  }

  // ─── Galaxy portal ────────────────────────────────────────────

  private createGalaxyPortal(this: Phaser.Scene & WorldScene) {
    const px = WORLD_W - T*5, py = T*5;
    const portal = this.add.circle(px, py, 28, 0x7c3aed, 0.85).setDepth(15).setInteractive();
    this.add.circle(px, py, 36, 0x818cf8, 0.2).setDepth(14);
    this.add.text(px, py+42, "🌌 Galáxia", { fontSize: "9px", color: "#c4b5fd" }).setOrigin(0.5).setDepth(15);
    portal.on("pointerdown", () => window.dispatchEvent(new CustomEvent("space-station:open-galaxy")));
    this.tweens.add({ targets: portal, alpha: { from: 0.6, to: 1 }, duration: 1500, yoyo: true, repeat: -1 });
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private addWall(x: number, y: number, w: number, h: number) {
    const img = this.walls.create(x + w / 2, y + h / 2, "__blank__") as Phaser.Physics.Arcade.Image;
    img.setDisplaySize(w, h).setVisible(false);
    const sBody = img.body as Phaser.Physics.Arcade.StaticBody;
    sBody.setSize(w, h, true);
    sBody.updateFromGameObject();
  }

  private drawDesk(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, type: string, chairType: string) {
    if (type === "space") {
      this.fillRect(g, C.DESK_SPACE, x, y, w, h);
      g.lineStyle(1, C.DESK_SPACE_GL, 0.5); g.strokeRect(x, y, w, h);
      this.fillRect(g, C.DESK_SPACE_GL, x+8, y+4, 18, 12, 0.5);
    } else if (type === "minimal") {
      this.fillRect(g, 0xe8e8e0, x, y, w, h);
      g.lineStyle(1, 0xccccbc, 0.8); g.strokeRect(x, y, w, h);
      this.fillRect(g, C.MONITOR, x+8, y+4, 16, 12);
    } else {
      this.fillRect(g, C.DESK_TOP, x, y, w, h);
      this.fillRect(g, C.DESK_EDGE, x, y+h-4, w, 4);
      this.fillRect(g, C.MONITOR, x+8, y+4, 18, 13);
      this.fillRect(g, C.MONITOR_GLOW, x+10, y+6, 14, 9, 0.5);
      if (w > 80) { this.fillRect(g, C.MONITOR, x+w-28, y+4, 18, 13); this.fillRect(g, C.MONITOR_GLOW, x+w-26, y+6, 14, 9, 0.5); }
    }
    this.drawChair(g, x + w/2 - 10, y + h + 2, 20, chairType);
  }

  private drawChair(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, type: string) {
    if (type === "rocket") {
      this.fillRect(g, C.CHAIR_ROCKET, x, y, w, 16);
      this.fillRect(g, C.CHAIR_RPAD, x+2, y+2, w-4, 12);
      this.fillRect(g, C.ROCKET_ACCENT, x+w/2-2, y+2, 4, 6, 0.5);
    } else {
      this.fillRect(g, C.CHAIR_OFFICE, x, y, w, 14);
      this.fillRect(g, C.CHAIR_SEAT, x+2, y+2, w-4, 10, 0.7);
    }
  }

  private drawPlant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    this.fillRect(g, 0xb05a30, x, y+16, 16, 12);
    this.circle(g, 0x2d8a4e, x+8, y+12, 12);
    this.circle(g, 0x1a6635, x+4, y+8, 7, 0.5);
  }

  // ─── Remote players ───────────────────────────────────────────

  private onRemoteJoin(data: {
    userId:     string;
    x:          number;
    y:          number;
    name:       string;
    spriteUrl?: string | null;
    overlays?: {
      eyes?:      string | null;
      hair?:      string | null;
      clothes?:   string | null;
      hat?:       string | null;
      accessory?: string | null;
    } | null;
  }) {
    if (data.userId === this.localUserId) return;

    const existing = this.remotePlayers.get(data.userId);

    // Cache key combines base URL + overlays so we only rebuild when any layer changes
    const resolvedUrl = resolveRemoteSpriteUrl(data.spriteUrl, data.userId);
    const overlayKey = JSON.stringify(data.overlays ?? {});
    const fullKey   = `${resolvedUrl}|${overlayKey}`;

    if (existing) {
      existing.gfx.setPosition(data.x, data.y);
      existing.nameText.setPosition(data.x, data.y - 36);
      existing.sprite?.setPosition(data.x, data.y);

      if (data.name && existing.nameText.text !== data.name) {
        existing.nameText.setText(data.name);
      }

      const alreadyLoaded  = existing.loadedSpriteUrl  === fullKey;
      const alreadyLoading = existing.pendingSpriteUrl === fullKey;
      if (!alreadyLoaded && !alreadyLoading) {
        this.loadRemoteSprite(existing, data.userId, resolvedUrl, data.x, data.y, data.overlays ?? null, fullKey);
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[WorldScene] creating remote player:", data.userId, "name:", data.name);
    }

    const gfx = this.add.graphics().setDepth(19);
    gfx.setPosition(data.x, data.y);

    const nameText = this.add.text(data.x, data.y - 36, data.name, {
      fontSize: "9px", color: "#fde68a",
      backgroundColor: "#00000088", padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(22);

    const entry: RemotePlayer = { gfx, nameText, loadedSpriteUrl: null, pendingSpriteUrl: null, loadGen: 0 };
    this.remotePlayers.set(data.userId, entry);

    this.loadRemoteSprite(entry, data.userId, resolvedUrl, data.x, data.y, data.overlays ?? null, fullKey);
  }

  /** Load (or reload) the Pipoya sprite for a remote player via HTMLImage (cancellable) */
  private loadRemoteSprite(
    entry:     RemotePlayer,
    userId:    string,
    spriteUrl: string,
    x:         number,
    y:         number,
    overlays: {
      eyes?:      string | null;
      hair?:      string | null;
      clothes?:   string | null;
      hat?:       string | null;
      accessory?: string | null;
    } | null = null,
    cacheKey: string = spriteUrl,
  ) {
    if (entry._imgEl) {
      entry._imgEl.onload  = null;
      entry._imgEl.onerror = null;
      entry._imgEl = undefined;
    }

    entry.pendingSpriteUrl = cacheKey;
    entry.loadGen = (entry.loadGen ?? 0) + 1;
    const loadGen = entry.loadGen;

    const safeKey = userId.replace(/[^a-zA-Z0-9]/g, "_");
    const texKey  = `__remote_${safeKey}__`;

    const applyTexture = (canvas: HTMLCanvasElement) => {
      if (entry.loadGen !== loadGen) return;
      if (!this.scene?.isActive?.()) return;

      if (this.textures.exists(texKey)) this.textures.remove(texKey);

      const fw = canvas.width <= 96 ? 32 : 64;
       
      this.textures.addSpriteSheet(texKey, canvas as any, {
        frameWidth: fw, frameHeight: fw,
        startFrame: 0, endFrame: Math.floor(canvas.width / fw) * Math.floor(canvas.height / fw) - 1,
      });

      if (entry.sprite) { entry.sprite.destroy(); entry.sprite = undefined; }

      const frameKey = `${texKey}_idle`;
      if (!this.textures.get(texKey).has(frameKey)) {
        this.textures.get(texKey).add(frameKey, 0, fw, 0, fw, fw);
      }

      // Use current gfx position — may have been updated while sprite was loading
      const curX = entry.gfx?.x ?? x;
      const curY = entry.gfx?.y ?? y;
      const spr = this.add.sprite(curX, curY, texKey, frameKey)
        .setDepth(20)
        .setScale(fw === 32 ? 1.5 : 0.5);

      entry.sprite          = spr;
      entry.loadedSpriteUrl  = cacheKey;
      entry.pendingSpriteUrl = null;
      entry._imgEl           = undefined;
    };

    const fallbackCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 96; canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(6, 8, 20, 24);
      ctx.fillStyle = "#FFDBB4";
      ctx.beginPath(); ctx.arc(16, 10, 8, 0, Math.PI * 2); ctx.fill();
      return canvas;
    };

    const hasOverlays = !!(overlays &&
      (overlays.eyes || overlays.hair || overlays.clothes ||
       overlays.hat  || overlays.accessory));

    // Fast path: no overlays → plain image load
    if (!hasOverlays) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      entry._imgEl = img;
      img.onload = () => {
        if (entry.loadGen !== loadGen) return;
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        applyTexture(canvas);
      };
      img.onerror = () => {
        if (entry.loadGen !== loadGen) return;
        applyTexture(fallbackCanvas());
      };
      img.src = spriteUrl;
    } else {
      // Slow path: composite base + overlays
      buildCompositeSpritesheet({
        base:      spriteUrl,
        eyes:      overlays?.eyes,
        hair:      overlays?.hair,
        clothes:   overlays?.clothes,
        hat:       overlays?.hat,
        accessory: overlays?.accessory,
      }).then((canvas) => {
        if (entry.loadGen !== loadGen) return;
        applyTexture(canvas ?? fallbackCanvas());
      });
    }

    if (entry.sprite) { entry.sprite.destroy(); entry.sprite = undefined; }
  }

  private onRemoteMove(data: { userId: string; x: number; y: number }) {
    const p = this.remotePlayers.get(data.userId);
    if (!p) return;
    p.gfx.setPosition(data.x, data.y);
    p.nameText.setPosition(data.x, data.y - 36);
    p.sprite?.setPosition(data.x, data.y);
  }

  private onRemoteLeave(data: { userId: string }) {
    const p = this.remotePlayers.get(data.userId);
    if (!p) return;
    p.gfx.destroy();
    p.nameText.destroy();
    p.sprite?.destroy();
    this.remotePlayers.delete(data.userId);
    // Notify WebRTC hook to close peer connection
    if (this.nearbyPeers.has(data.userId)) {
      this.nearbyPeers.delete(data.userId);
      window.dispatchEvent(new CustomEvent("space-station:proximity-leave", {
        detail: { peerId: data.userId },
      }));
    }
  }

  // ─── Avatar scale helpers ────────────────────────────────────

  /** Garante que a escala fique entre 0.5 e 2.5. */
  private clampAvatarScale(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 1;
    return Math.max(0.5, Math.min(2.5, value));
  }

  /** Aplica novo multiplicador de escala ao sprite local + body de colisão.
   *  Mantém o baseScale do formato (LPC vs Pipoya). */
  private applyAvatarScale(this: Phaser.Scene & WorldScene, scale: number) {
    if (!this.lpcSprite) return;
    const userScale = this.clampAvatarScale(scale);
    const baseScale = (this.lpcSprite.getData("baseScale") as number) ?? 1;
    const isPipoya  = (this.lpcSprite.getData("isPipoya")  as boolean) ?? false;

    this.lpcSprite.setScale(baseScale * userScale);

    // Reescala o body de colisão proporcionalmente — o body cresce
    // junto com o sprite pra colisão continuar coerente.
    // Defensive: body pode ser undefined se a scene está em destroy ou se
    // o sprite ainda não foi adicionado ao physics manager.
    const body = this.lpcSprite.body as
      | Phaser.Physics.Arcade.Body
      | undefined;
    if (!body) return;
    if (isPipoya) {
      body.setSize(20 * userScale, 28 * userScale).setOffset(6 * userScale, 4 * userScale);
    } else {
      body.setSize(24 * userScale, 40 * userScale).setOffset(20 * userScale, 22 * userScale);
    }
  }

  // ─── Zoom helpers ─────────────────────────────────────────────

  private applyZoom(this: Phaser.Scene & WorldScene, delta: number) {
    this.setZoom(this.currentZoom + delta);
  }

  /** Zoom mínimo dinâmico que ainda mantém o viewport DENTRO do mapa.
   *  Sem isso o user pode dar zoom out até ver o fundo preto além das
   *  bordas. Calcula `viewportSize / mapSize` em ambas as dimensões — o
   *  maior dos dois garante que nenhuma direção sobre. */
  private getDynamicMinZoom(this: Phaser.Scene & WorldScene): number {
    if (!this.cameras?.main) return this.ZOOM_MIN;
    const cam = this.cameras.main;
    const bounds = cam.getBounds();
    const mapW = bounds.width || 1;
    const mapH = bounds.height || 1;
    const need = Math.max(cam.width / mapW, cam.height / mapH);
    // Nunca abaixo de ZOOM_MIN absoluto; nunca acima de ZOOM_MAX.
    return Math.min(this.ZOOM_MAX, Math.max(this.ZOOM_MIN, need));
  }

  private setZoom(this: Phaser.Scene & WorldScene, value: number) {
    // Defensive: scene pode estar em destroy quando recebe um zoom event.
    if (!this.cameras?.main) return;
    const dynMin = this.getDynamicMinZoom();
    this.currentZoom = Math.min(this.ZOOM_MAX, Math.max(dynMin, value));
    this.cameras.main.setZoom(this.currentZoom);
    // Notify React of the current zoom level
    window.dispatchEvent(new CustomEvent("space-station:zoom-changed", {
      detail: { zoom: this.currentZoom, min: dynMin, max: this.ZOOM_MAX },
    }));
  }

  // ─── Update ───────────────────────────────────────────────────

  update(this: Phaser.Scene & WorldScene, _time: number, delta: number) {
    // ── Emit camera-view for minimap (throttled ~5x/s) ────────────
    if (this.editorActive) {
      this.cameraViewTickAcc += delta;
      if (this.cameraViewTickAcc >= 200) {
        this.cameraViewTickAcc = 0;
        this.emitCameraView();
      }
    }
    const speed = 160;
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const moving = up || down || left || right;

    if (this.lpcSprite) {
      // ── LPC sprite movement ──────────────────────────────────────
      const body = this.lpcSprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      if (up)    { body.setVelocityY(-speed); this.facingDir = "up"; }
      if (down)  { body.setVelocityY(speed);  this.facingDir = "down"; }
      if (left)  { body.setVelocityX(-speed); this.facingDir = "left"; }
      if (right) { body.setVelocityX(speed);  this.facingDir = "right"; }

      const walkKey = `lpc_walk_${this.facingDir}`;
      const idleKey = `lpc_idle_${this.facingDir}`;
      const curKey  = this.lpcSprite.anims.currentAnim?.key ?? "";

      if (moving) {
        if (curKey !== walkKey) this.lpcSprite.anims.play(walkKey, true);
      } else {
        if (curKey !== idleKey) this.lpcSprite.anims.play(idleKey, true);
      }

      this.playerLabel.setPosition(this.lpcSprite.x, this.lpcSprite.y - 44);

      if (this.game.getFrame() % 6 === 0 && moving) {
        window.dispatchEvent(new CustomEvent("space-station:player-moved", {
          detail: { x: this.lpcSprite.x, y: this.lpcSprite.y },
        }));
      }
    } else if (this.player) {
      // ── Canvas/SVG sprite movement ───────────────────────────────
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      if (up)    { body.setVelocityY(-speed); this.facingDir = "up"; }
      if (down)  { body.setVelocityY(speed);  this.facingDir = "down"; }
      if (left)  { body.setVelocityX(-speed); this.facingDir = "left"; }
      if (right) { body.setVelocityX(speed);  this.facingDir = "right"; }

      if (moving) {
        this.animTimer++;
        if (this.animTimer % 10 === 0) {
          this.animFrame = (this.animFrame + 1) % 2;
          this.player.setTexture(this.animFrame === 0 ? "__player_walk_a__" : "__player_walk_b__");
          this.player.setFlipX(this.facingDir === "left");
        }
      } else {
        this.animFrame = 0; this.animTimer = 0;
        this.player.setTexture("__player_idle__");
      }

      this.playerLabel.setPosition(this.player.x, this.player.y - 36);

      if (this.game.getFrame() % 6 === 0 && moving) {
        window.dispatchEvent(new CustomEvent("space-station:player-moved", {
          detail: { x: this.player.x, y: this.player.y },
        }));
      }
    }

    // ── Proximity check (every 30 frames ~0.5s) ──────────────────
    if (this.game.getFrame() % 30 === 0) {
      this.checkProximity();
      this.checkAreaTriggers();
    }

    // ── Animate proximity circle ──────────────────────────────────
    if (this.proximityCircle) {
      const active2 = this.lpcSprite ?? this.player;
      if (active2) {
        this.proximityCircle.setPosition(active2.x, active2.y);
        if (this.proximityPulse) {
          this.proximityPulse.setPosition(active2.x, active2.y);
          this.proximityPulseScale += 0.004 * this.proximityPulseDir;
          if (this.proximityPulseScale > 1.08) this.proximityPulseDir = -1;
          if (this.proximityPulseScale < 0.92) this.proximityPulseDir =  1;
          this.proximityPulse.setScale(this.proximityPulseScale);
        }
      }
    }
  }

  private updateProximityCircle(this: Phaser.Scene & WorldScene, active: boolean, x: number, y: number) {
    if (active && !this.proximityCircle) {
      const r = this.PROXIMITY_RADIUS;

      // Outer pulse ring
      const pulse = this.add.graphics().setDepth(18);
      pulse.lineStyle(2, 0xffffff, 0.12);
      pulse.strokeCircle(0, 0, r + 12);
      pulse.setPosition(x, y);
      this.proximityPulse = pulse;

      // Main circle: filled + border
      const g = this.add.graphics().setDepth(18);
      // Subtle filled area
      g.fillStyle(0x6366f1, 0.06);
      g.fillCircle(0, 0, r);
      // Crisp dashed border — drawn as many short arcs
      const segments = 36;
      for (let i = 0; i < segments; i++) {
        if (i % 2 === 0) {
          const a0 = (i / segments) * Math.PI * 2;
          const a1 = ((i + 1) / segments) * Math.PI * 2;
          g.lineStyle(1.5, 0x818cf8, 0.55);
          g.beginPath();
          g.arc(0, 0, r, a0, a1);
          g.strokePath();
        }
      }
      g.setPosition(x, y);
      this.proximityCircle = g;

    } else if (!active && this.proximityCircle) {
      this.proximityCircle.destroy();
      this.proximityCircle = null;
      this.proximityPulse?.destroy();
      this.proximityPulse = null;
    }
  }

  private checkProximity(this: Phaser.Scene & WorldScene) {
    const active = this.lpcSprite ?? this.player;
    if (!active) return;
    const px = active.x;
    const py = active.y;
    const r  = this.PROXIMITY_RADIUS;
    const nowNear = new Set<string>();

    this.remotePlayers.forEach((rp, userId) => {
      const dx = rp.gfx.x - px;
      const dy = rp.gfx.y - py;
      if (Math.sqrt(dx*dx + dy*dy) <= r) {
        nowNear.add(userId);
        if (!this.nearbyPeers.has(userId)) {
          // entered proximity
          window.dispatchEvent(new CustomEvent("space-station:proximity-enter", {
            detail: {
              peerId:    userId,
              peerName:  rp.nameText.text,
              peerImage: null,
            },
          }));
        }
      }
    });

    // Show/hide proximity circle
    this.updateProximityCircle(nowNear.size > 0, px, py);

    // Detect departures
    this.nearbyPeers.forEach(userId => {
      if (!nowNear.has(userId)) {
        window.dispatchEvent(new CustomEvent("space-station:proximity-leave", {
          detail: { peerId: userId },
        }));
      }
    });

    this.nearbyPeers = nowNear;
  }

  // ─── Area triggers ────────────────────────────────────────────

  private checkAreaTriggers(this: Phaser.Scene & WorldScene) {
    const active = this.lpcSprite ?? this.player;
    if (!active) return;

    const px = active.x;
    const py = active.y;

    const nowInside = new Set<string>();
    for (const area of this.areasState) {
      if (px >= area.x && px <= area.x + area.w &&
          py >= area.y && py <= area.y + area.h) {
        nowInside.add(area.id);
      }
    }

    // Detect enter events
    for (const id of nowInside) {
      if (!this.insideAreaIds.has(id)) {
        const area = this.areasState.find(a => a.id === id);
        if (area) {
          this.onAreaEnter(area);
        }
      }
    }

    // Detect leave events
    for (const id of this.insideAreaIds) {
      if (!nowInside.has(id)) {
        const area = this.areasState.find(a => a.id === id);
        if (area) {
          window.dispatchEvent(new CustomEvent("space-station:area-leave", {
            detail: { areaId: id, type: area.type },
          }));
        }
      }
    }

    this.insideAreaIds = nowInside;
  }

  private onAreaEnter(this: Phaser.Scene & WorldScene, area: MapArea) {
    window.dispatchEvent(new CustomEvent("space-station:area-enter", {
      detail: { areaId: area.id, type: area.type, props: area.props },
    }));

    // Built-in triggers
    if (area.type === "credits") {
      window.dispatchEvent(new CustomEvent("space-station:open-credits"));
    }
    if (area.type === "info" && area.props?.message) {
      window.dispatchEvent(new CustomEvent("space-station:show-info", {
        detail: { message: area.props.message },
      }));
    }
    if (area.type === "website" && area.props?.url) {
      window.dispatchEvent(new CustomEvent("space-station:open-website", {
        detail: { url: area.props.url },
      }));
    }
  }

  // ─── Drawing utils ────────────────────────────────────────────

  private fillRect(g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w: number, h: number, alpha = 1) {
    g.fillStyle(color, alpha); g.fillRect(x, y, w, h);
  }

  private circle(g: Phaser.GameObjects.Graphics, color: number, cx: number, cy: number, r: number, alpha = 1) {
    g.fillStyle(color, alpha); g.fillCircle(cx, cy, r);
  }
}
