"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
const EmpresasPanel = dynamic(() => import("./empresas-panel"), { ssr: false });
import { X, Globe, Settings, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StationWorldConfig, AvatarConfig, AreaType } from "../../types";
import { AREA_TYPE_META } from "../../types";
import { StationExplorer } from "../station-explorer";
import { WorldSettingsPanel } from "./world-settings-panel";
import { MediaBar } from "./media-bar";
import { MediaSettingsPanel } from "./media-settings-panel";
import { VideoOverlay } from "./video-overlay";
import { BubbleAppsPanel, type BubbleApp } from "./bubble-apps-panel";
import { BubbleChatPanel } from "./bubble-chat-panel";
import { toast } from "sonner";
import { ProximityBar } from "./proximity-bar";
import { ConnectPeoplePanel } from "./connect-people-panel";
import { SharePanel } from "./share-panel";
import { CreditsPanel } from "./credits-panel";
import { WokaAvatarPanel } from "./woka-avatar-panel";
import { ScreenShareOverlay } from "./screen-share-overlay";
import { MapMenu } from "./map-editor/map-menu";
import { MapEditor } from "./map-editor/map-editor";
import { PublishTemplateModal } from "./publish-template-modal";
import { useWebRTC } from "../../hooks/use-webrtc";
import { useSfuRoom } from "../../hooks/use-sfu-room";
import { useJoinWorld } from "../../hooks/use-station-world";
import { useWorldPresence } from "../../hooks/use-world-presence";

/**
 * Feature flag de transporte de mídia.
 *
 * - `useSfuRoom` (LiveKit) é a estratégia alvo: escala pra ~100 pessoas com
 *   TURN/relay e resolve a classe inteira dos bugs de NAT/firewall/autoplay.
 *   Default ON quando o LiveKit está configurado (env vars de servidor).
 * - `useWebRTC` (mesh P2P) fica como fallback até a Fase 2 validar o SFU em
 *   produção. Defina `NEXT_PUBLIC_USE_SFU=false` pra forçar o mesh.
 *
 * A flag e o mesh saem na Fase 4 (limpeza).
 */
const USE_SFU = process.env.NEXT_PUBLIC_USE_SFU !== "false";

interface Props {
  worldConfig: StationWorldConfig;
  avatarConfig?: AvatarConfig;
  stationId: string;
  nick: string;
  isOwner?: boolean;
  userImage?: string | null;
  /** User session data for WebRTC identity */
  userId?: string;
  userName?: string;
  userNick?: string;
}

export function SpaceGame({
  worldConfig: initialWorldConfig,
  avatarConfig: initialAvatarConfig,
  stationId,
  nick,
  isOwner,
  userImage,
  userId: rawUserId = "guest",
  userName = nick,
  userNick,
}: Props) {
  // Guests share the same server-side userId (derived from stationId), which
  // causes each tab to filter out others' events thinking they are themselves.
  // We assign a stable per-tab unique ID stored in sessionStorage so every
  // open tab — even in incognito or localhost — gets a distinct identity.
  const [effectiveUserId] = useState<string>(() => {
    if (typeof window === "undefined") return rawUserId;
    // Logged-in users already have a real UUID — use it as-is
    if (!rawUserId.startsWith("guest")) return rawUserId;
    const KEY = `_nasa_world_uid_${stationId}`;
    try {
      const stored = sessionStorage.getItem(KEY);
      if (stored) return stored;
      const fresh = `${rawUserId}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(KEY, fresh);
      return fresh;
    } catch {
      // sessionStorage unavailable (rare) — fall back to transient random
      return `${rawUserId}_${Math.random().toString(36).slice(2, 9)}`;
    }
  });
  const userId = effectiveUserId;

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [galaxyOpen, setGalaxyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [worldConfig, setWorldConfig] = useState(initialWorldConfig);

  // Avatar state — overlaid with the per-visitor localStorage copy so each
  // user (including guests in incognito) keeps their customisation on refresh.
  // The station's `avatarConfig` coming from the DB is only the default for
  // visitors who have never customised. Per-visitor preferences live client-side
  // because only the station OWNER can write to SpaceStationWorld.avatarConfig.
  const avatarLocalKey = `_nasa_avatar_${stationId}_${userId}`;
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | undefined>(
    () => {
      if (typeof window === "undefined") return initialAvatarConfig;
      try {
        const stored = localStorage.getItem(avatarLocalKey);
        if (stored) {
          const parsed = JSON.parse(stored) as AvatarConfig;
          // Merge station defaults with personal overrides (personal wins)
          return { ...initialAvatarConfig, ...parsed } as AvatarConfig;
        }
      } catch {
        /* ignore parse errors, fall through to default */
      }
      return initialAvatarConfig;
    },
  );

  // Persist avatar changes immediately to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !avatarConfig) return;
    try {
      localStorage.setItem(avatarLocalKey, JSON.stringify(avatarConfig));
    } catch {
      /* quota exceeded or disabled — non-fatal */
    }
  }, [avatarConfig, avatarLocalKey]);
  const [zoomLevel, setZoomLevel] = useState(1.6);
  const [zoomMin, setZoomMin] = useState(0.4);
  const [zoomMax, setZoomMax] = useState(3.5);
  const [pipActive, setPipActive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [avatarPanelOpen, setAvatarPanelOpen] = useState(false);
  const [connectPanelOpen, setConnectPanelOpen] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [mapEditorOpen, setMapEditorOpen] = useState(false);
  const [empresasOpen, setEmpresasOpen] = useState(false);
  const [chatPeerId, setChatPeerId] = useState<string | null>(null);
  const [chatPeerName, setChatPeerName] = useState<string | null>(null);
  const [areaToast, setAreaToast] = useState<{
    id: string;
    type: AreaType;
    title: string;
    message: string;
  } | null>(null);
  const [websiteOverlay, setWebsiteOverlay] = useState<{
    url: string;
    areaId: string;
  } | null>(null);
  const [exitOverlay, setExitOverlay] = useState<{
    targetNick: string;
    areaId: string;
  } | null>(null);
  const areaAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Mídia (LiveKit SFU com fallback mesh) ─────────────────────────────────
  // Dois caminhos:
  //   1. Usuário logado → `useJoinWorld` busca token da station no servidor.
  //   2. Guest → SFU desabilitado (sem auth), cai no mesh (P2P).
  const isLoggedIn = !rawUserId.startsWith("guest");
  const joinWorldQuery = useJoinWorld(stationId, {
    enabled: USE_SFU && isLoggedIn,
  });
  const sfuToken = joinWorldQuery.data?.sfuToken ?? null;
  const sfuWsUrl = joinWorldQuery.data?.sfuWsUrl ?? null;
  const sfuReady = USE_SFU && Boolean(sfuToken && sfuWsUrl);
  // Enquanto buscamos o token SFU de um usuário logado, NÃO subimos o mesh: ele
  // só conectaria no Pusher pra ser derrubado segundos depois quando o token
  // chega (churn + risco de listeners órfãos). Só caímos no mesh quando o join
  // resolve sem SFU utilizável (guest, LiveKit off, ou mint falhou).
  const sfuPending = USE_SFU && isLoggedIn && joinWorldQuery.isLoading;

  const sfu = useSfuRoom({
    token: sfuReady ? sfuToken : null,
    wsUrl: sfuReady ? sfuWsUrl : null,
    userId,
    userName,
    userImage,
  });
  const mesh = useWebRTC({
    stationId,
    userId,
    userName,
    userImage,
    enabled: !sfuReady && !sfuPending,
  });
  const webrtc = sfuReady ? sfu : mesh;

  // ── World presence (multiplayer positions) ─────────────────────────────────
  // IMPORTANT: broadcast the RAW spriteUrl (may be the "pixel_astronaut"
  // sentinel or a real URL), NOT the locally-resolved PNG. If we resolved
  // pixel_astronaut here, every remote viewer would receive the shared base
  // PNG "/lpc_pixel_astronaut.png" and render every such user with the same
  // sprite. resolveRemoteSpriteUrl() on the receiver side handles the sentinel
  // by falling back to a deterministic Pipoya sprite per userId.
  const rawSpriteUrl = (
    avatarConfig as (AvatarConfig & { lpcSpritesheetUrl?: string }) | undefined
  )?.lpcSpritesheetUrl;
  // Overlays follow the same broadcast convention — raw values transmitted so
  // receivers can composite the final sprite on their side.
  const overlays = {
    eyes: avatarConfig?.wokaEyesUrl ?? null,
    hair: avatarConfig?.wokaHairUrl ?? null,
    clothes: avatarConfig?.wokaClothesUrl ?? null,
    hat: avatarConfig?.wokaHatUrl ?? null,
    accessory: avatarConfig?.wokaAccessoryUrl ?? null,
  };
  useWorldPresence({
    stationId,
    userId,
    userName,
    userNick,
    spriteUrl: rawSpriteUrl,
    overlays,
  });

  // ── Phaser game init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let game: import("phaser").Game | null = null;
    setLoading(true);

    async function initGame() {
      const PhaserModule = await import("phaser");
      const Phaser = PhaserModule.default ?? PhaserModule;
      const { PreloadScene } = await import("./scenes/preload-scene");
      const { WorldScene } = await import("./scenes/world-scene");
      const { buildGameConfig } = await import("./game-config");

      const capturedWorldConfig = worldConfig;
      const capturedAvatarConfig = avatarConfig;
      const capturedUserImage = userImage;
      const capturedUserId = userId;

      // Pré-renderizar mapa Tiled direto no <canvas> antes do Phaser iniciar
      let tiledCanvas: HTMLCanvasElement | null = null;
      let tiledWidthPx: number = 0;
      let tiledHeightPx: number = 0;
      let tiledSpawnX: number = 0;
      let tiledSpawnY: number = 0;
      const rawMap = capturedWorldConfig.mapData as
        | import("../../types").WorldMapData
        | null;
      if (rawMap?.scenario === "tiled" && rawMap.tiledMapUrl) {
        try {
          const { renderTiledMapToCanvas } =
            await import("../../utils/tiled-canvas-renderer");
          const result = await renderTiledMapToCanvas(
            rawMap.tiledMapUrl,
            rawMap.tiledBaseUrl ??
              rawMap.tiledMapUrl.substring(
                0,
                rawMap.tiledMapUrl.lastIndexOf("/") + 1,
              ),
          );
          tiledCanvas = result.canvas;
          tiledWidthPx = result.widthPx;
          tiledHeightPx = result.heightPx;
          tiledSpawnX = result.spawnX;
          tiledSpawnY = result.spawnY;
        } catch (e) {
          console.error("[SpaceGame] Falha ao pré-renderizar mapa Tiled:", e);
        }
      }

      const worldSceneWithData = class extends WorldScene {
        init() {
          super.init({
            worldConfig: capturedWorldConfig,
            avatarConfig: capturedAvatarConfig,
            userImage: capturedUserImage,
            userId: capturedUserId,
            tiledCanvas,
            tiledWidthPx,
            tiledHeightPx,
            tiledSpawnX,
            tiledSpawnY,
          });
        }
      };

      const w = window.innerWidth;
      const h = window.innerHeight;
      const config = buildGameConfig("phaser-container", w, h, [
        PreloadScene,
        worldSceneWithData,
      ]);
      game = new Phaser.Game(config);
      gameRef.current = game;
      setLoading(false);
    }

    initGame();

    const onGalaxy = () => setGalaxyOpen(true);
    const onCredits = () => setCreditsOpen(true);
    const onZoomChanged = (e: Event) => {
      const { zoom, min, max } = (e as CustomEvent).detail as {
        zoom: number;
        min: number;
        max: number;
      };
      setZoomLevel(zoom);
      setZoomMin(min);
      setZoomMax(max);
    };
    const onAreaEnter = (e: Event) => {
      const { areaId, type, props } = (e as CustomEvent).detail as {
        areaId: string;
        type: AreaType;
        props?: {
          message?: string;
          url?: string;
          roomName?: string;
          audioUrl?: string;
          targetNick?: string;
          // NASA props
          agendaSlug?: string;
          workspaceId?: string;
          trackingId?: string;
          formId?: string;
          courseId?: string;
          nboxItemId?: string;
          imageUrl?: string;
          imageAlt?: string;
          socialRoute?: string;
          openInNewTab?: boolean;
          profileMode?: "self" | "click";
        };
      };

      // ── Website: mostra overlay com botão de abrir ──────────────────────
      if (type === "website") {
        const url = props?.url;
        if (url) setWebsiteOverlay({ url, areaId });
        return;
      }

      // ── Imagem-link: trata como website (URL de destino) ────────────────
      if (type === "imagem-link") {
        const url = props?.url;
        if (url) setWebsiteOverlay({ url, areaId });
        return;
      }

      // ── Exit: mostra overlay de portal ──────────────────────────────────
      if (type === "exit") {
        const targetNick = props?.targetNick ?? "";
        setExitOverlay({ targetNick, areaId });
        return;
      }

      // ── Play-audio: inicia reprodução ────────────────────────────────────
      if (type === "play-audio") {
        const audioUrl = props?.audioUrl;
        if (audioUrl) {
          try {
            if (areaAudioRef.current) {
              areaAudioRef.current.pause();
              areaAudioRef.current = null;
            }
            const audio = new Audio(audioUrl);
            audio.loop = true;
            audio.volume = 0.4;
            audio.play().catch(() => {
              /* autoplay blocked — silently ignore */
            });
            areaAudioRef.current = audio;
          } catch {
            /* ignore */
          }
        }
        const meta = AREA_TYPE_META[type];
        if (!meta) return;
        setAreaToast({
          id: areaId,
          type,
          title: `${meta.emoji} Áudio`,
          message: "Reproduzindo áudio da área.",
        });
        return;
      }

      // ── Credits: já tratado pelo WorldScene (open-credits) ──────────────
      if (type === "credits") return;

      // ── Demais tipos: toast informativo ──────────────────────────────────
      const meta = AREA_TYPE_META[type];
      if (!meta) return;
      const messages: Partial<Record<AreaType, string>> = {
        silent:
          "Você está em uma zona silenciosa. Apenas quem estiver dentro pode ouvir você.",
        focus:
          "Você entrou em uma área de foco. Apenas quem estiver dentro dela pode ouvir você.",
        entry: "Ponto de entrada da estação.",
        meeting: props?.roomName
          ? `Sala de reunião: ${props.roomName}`
          : "Você entrou em uma sala de reunião.",
        info: props?.message ?? "Informação da área.",
        custom: props?.message ?? "Você entrou em uma área personalizada.",
        // ─── Funções NASA ───────────────────────────────────────────────
        "n-box": props?.nboxItemId
          ? "Documento autorizado disponível. (Visualizador em breve)"
          : "Configure um arquivo do N-Box pro visitante baixar.",
        agendamento: props?.agendaSlug
          ? "Reserve um horário nesta agenda. (Tela em breve)"
          : "Esta área de agendamento ainda não tem uma agenda configurada.",
        demanda: props?.workspaceId
          ? "Solicite uma demanda no Workspace. (Modal em breve)"
          : "Configure um workspace pra esta área de demanda.",
        balcao:
          "🛎️ Em atendimento — aguardando próximo na fila. (Cena fictícia em breve)",
        profile:
          props?.profileMode === "self"
            ? "Vendo seu perfil. (Painel em breve)"
            : "Clique em um avatar próximo pra ver o perfil dele.",
        prateleira:
          "🛒 Loja de produtos — pague em Stars ou cartão. (Painel em breve)",
        auditorio: props?.courseId
          ? "Auditório — clique pra entrar no curso ao vivo. (Painel em breve)"
          : "Configure um curso pra este auditório.",
        "nasa-route": props?.courseId
          ? "Curso disponível — compre o acesso pra entrar. (Checkout em breve)"
          : "Configure um curso pra esta área NASA Route.",
        formulario: props?.formId
          ? "Preencha o formulário. (Modal em breve)"
          : "Configure um formulário pra esta área.",
        "rede-social": "💬 Rede social interna. (Painel em breve)",
        "imagem-link": props?.imageAlt
          ? `Abrir ${props.imageAlt}`
          : "Imagem clicável.",
      };
      const message = messages[type];
      if (!message) return;
      setAreaToast({
        id: areaId,
        type,
        title: `${meta.emoji} ${meta.label === "Silenciosa" ? "Zona silenciosa" : meta.label}`,
        message,
      });
    };
    const onAreaLeave = (e: Event) => {
      const { areaId } = (e as CustomEvent).detail as { areaId: string };
      setAreaToast((prev) => (prev?.id === areaId ? null : prev));
      setWebsiteOverlay((prev) => (prev?.areaId === areaId ? null : prev));
      setExitOverlay((prev) => (prev?.areaId === areaId ? null : prev));
      // Para áudio ao sair da área
      if (areaAudioRef.current) {
        areaAudioRef.current.pause();
        areaAudioRef.current = null;
      }
    };

    window.addEventListener("space-station:open-galaxy", onGalaxy);
    window.addEventListener("space-station:open-credits", onCredits);
    window.addEventListener("space-station:zoom-changed", onZoomChanged);
    window.addEventListener("space-station:area-enter", onAreaEnter);
    window.addEventListener("space-station:area-leave", onAreaLeave);

    return () => {
      window.removeEventListener("space-station:open-galaxy", onGalaxy);
      window.removeEventListener("space-station:open-credits", onCredits);
      window.removeEventListener("space-station:zoom-changed", onZoomChanged);
      window.removeEventListener("space-station:area-enter", onAreaEnter);
      window.removeEventListener("space-station:area-leave", onAreaLeave);
      // Destroy whichever instance is current (game may still be null if initGame didn't finish)
      const toDestroy = gameRef.current ?? game;
      toDestroy?.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldConfig, avatarConfig, stationId]);

  function handleApply(
    newWorldConfig: StationWorldConfig,
    newAvatarConfig: AvatarConfig,
    closePanel = false,
  ) {
    if (closePanel) setSettingsOpen(false);
    setWorldConfig(newWorldConfig);
    setAvatarConfig(newAvatarConfig);
  }

  const handleZoomIn = useCallback(
    () => window.dispatchEvent(new Event("space-station:zoom-in")),
    [],
  );
  const handleZoomOut = useCallback(
    () => window.dispatchEvent(new Event("space-station:zoom-out")),
    [],
  );
  const handleZoomReset = useCallback(
    () => window.dispatchEvent(new Event("space-station:zoom-reset")),
    [],
  );

  const zoomPct = Math.round((zoomLevel / 1.6) * 100);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* ── Banner de áudio bloqueado (autoplay policy) ── */}
      {webrtc.audioBlocked && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full
                     bg-amber-500/90 text-amber-950 text-xs font-medium shadow-lg
                     animate-pulse cursor-pointer select-none"
          onClick={() => {
            // Qualquer gesto dispara o startAudio interno do hook; este click
            // já é capturado pelo audio-unlock. Mantemos o elemento clicável
            // como pista visual.
          }}
        >
          🔊 Clique em qualquer lugar para ativar o áudio
        </div>
      )}
      {/* ── Banner de reconexão ── */}
      {webrtc.connectionState === "reconnecting" && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full
                     bg-yellow-500/90 text-yellow-950 text-xs font-medium shadow-lg"
        >
          🔄 Reconectando ao servidor de mídia…
        </div>
      )}
      {/* ── Loading overlay ── */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950">
          <div className="text-4xl mb-4 animate-pulse">🚀</div>
          <p className="text-white text-sm mb-4">Preparando mundo virtual...</p>
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              id="preload-bar"
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: "0%" }}
            />
          </div>
        </div>
      )}

      {/* ── Game canvas ── */}
      <div
        id="phaser-container"
        ref={containerRef}
        className={`absolute inset-0 w-full h-full${webrtc.settingsOpen ? " pointer-events-none" : ""}`}
      />

      {/* ── Media bar (top center) ── */}
      {!loading && (
        <MediaBar
          nick={nick}
          userName={userName}
          userImage={userImage}
          micOn={webrtc.micOn}
          camOn={webrtc.camOn}
          screenOn={webrtc.screenOn}
          onToggleMic={webrtc.toggleMic}
          onToggleCam={webrtc.toggleCam}
          onToggleScreen={webrtc.toggleScreen}
          onOpenSettings={() => webrtc.setSettingsOpen((o) => !o)}
          onOpenShare={() => setShareOpen((o) => !o)}
          localSpriteUrl={
            rawSpriteUrl === "pixel_astronaut"
              ? "/lpc_pixel_astronaut.png"
              : (rawSpriteUrl ?? null)
          }
          onOpenConnect={() => setConnectPanelOpen((o) => !o)}
          connectPanelOpen={connectPanelOpen}
          onOpenMap={() => setMapMenuOpen((o) => !o)}
          onOpenEmpresas={() => setEmpresasOpen(true)}
          onOpenAvatar={() => setSettingsOpen(true)}
          mapActive={mapMenuOpen || mapEditorOpen}
          peers={webrtc.peers}
          isOwner={isOwner}
        />
      )}

      {/* ── Area trigger toast ── */}
      {areaToast && !loading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className="max-w-sm rounded-2xl px-5 py-4 text-center shadow-2xl backdrop-blur-md border"
            style={{
              backgroundColor: `${AREA_TYPE_META[areaToast.type]?.color ?? "#94a3b8"}33`,
              borderColor: `${AREA_TYPE_META[areaToast.type]?.color ?? "#94a3b8"}66`,
            }}
          >
            <p className="text-white text-sm font-semibold mb-1">
              {areaToast.title}
            </p>
            <p className="text-white/90 text-xs leading-relaxed">
              {areaToast.message}
            </p>
          </div>
        </div>
      )}

      {/* ── Website area overlay (bottom-center, clicável) ── */}
      {websiteOverlay && !loading && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 max-w-sm">
            <Globe className="h-5 w-5 text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">Área Web</p>
              <p className="text-slate-400 text-xs truncate max-w-[180px]">
                {websiteOverlay.url}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 h-8 px-3 text-xs"
              onClick={() =>
                window.open(websiteOverlay.url, "_blank", "noopener,noreferrer")
              }
            >
              Abrir site
            </Button>
            <button
              className="text-slate-400 hover:text-white ml-1 shrink-0"
              onClick={() => setWebsiteOverlay(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Exit area overlay (portal de saída) ── */}
      {exitOverlay && !loading && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-amber-950/95 backdrop-blur-md border border-amber-500/30 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 max-w-sm">
            <span className="text-xl shrink-0">🚪</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">
                Portal de Saída
              </p>
              {exitOverlay.targetNick ? (
                <p className="text-amber-300 text-xs">
                  → @{exitOverlay.targetNick}
                </p>
              ) : (
                <p className="text-amber-300/70 text-xs">
                  Destino não configurado
                </p>
              )}
            </div>
            {exitOverlay.targetNick && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white shrink-0 h-8 px-3 text-xs"
                onClick={() => {
                  window.location.href = `/world/${exitOverlay.targetNick}`;
                }}
              >
                Ir
              </Button>
            )}
            <button
              className="text-amber-400 hover:text-white ml-1 shrink-0"
              onClick={() => setExitOverlay(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Empresas directory ── */}
      {empresasOpen && !loading && (
        <EmpresasPanel onClose={() => setEmpresasOpen(false)} />
      )}

      {/* ── Map dropdown menu ── */}
      {mapMenuOpen && !loading && (
        <MapMenu
          onClose={() => setMapMenuOpen(false)}
          onOpenEditor={() => setMapEditorOpen(true)}
          onExploreRoom={() =>
            window.dispatchEvent(new Event("space-station:zoom-reset"))
          }
          onGlobalMessage={() => {
            /* TODO: global message */
          }}
          onBackOffice={() => {
            if (isOwner) setSettingsOpen(true);
          }}
          canEdit={!!isOwner}
        />
      )}

      {/* ── Map editor panel (left side) ── */}
      {mapEditorOpen && !loading && isOwner && (
        <MapEditor
          stationId={stationId}
          worldConfig={worldConfig}
          onClose={() => setMapEditorOpen(false)}
          onWorldConfigChange={(next) => setWorldConfig(next)}
        />
      )}

      {/* ── Media settings dialog ── */}
      <MediaSettingsPanel
        open={webrtc.settingsOpen}
        onClose={() => webrtc.setSettingsOpen(false)}
        micOn={webrtc.micOn}
        camOn={webrtc.camOn}
        camError={webrtc.camError}
        onToggleMic={webrtc.toggleMic}
        onToggleCam={webrtc.toggleCam}
        localStream={webrtc.localStream}
        devices={webrtc.devices}
        selectedAudio={webrtc.selectedAudio}
        setSelectedAudio={webrtc.setSelectedAudio}
        selectedVideo={webrtc.selectedVideo}
        setSelectedVideo={webrtc.setSelectedVideo}
        selectedOutput={webrtc.selectedOutput}
        setSelectedOutput={webrtc.setSelectedOutput}
        onApplyDevices={webrtc.applyDeviceChange}
      />

      {/* ── Connect people panel (Conectar pessoas) — sempre montado para notificações ── */}
      {!loading && (
        <ConnectPeoplePanel
          stationId={stationId}
          userId={userId}
          userName={userName}
          open={connectPanelOpen}
          onClose={() => setConnectPanelOpen(false)}
        />
      )}

      {/* "Conectar pessoas" agora vive como ícone no MediaBar (left group),
          ao lado de Empresas. Botão standalone foi removido. */}

      {/* ── Proximity bar — top center, WorkAdventure-style ── */}
      {!loading && (
        <ProximityBar
          bubblePeers={webrtc.bubblePeers}
          peers={webrtc.peers}
          localName={userName}
          localNick={userNick}
          localMicOn={webrtc.micOn}
          localSpriteUrl={
            rawSpriteUrl === "pixel_astronaut"
              ? "/lpc_pixel_astronaut.png"
              : (rawSpriteUrl ?? null)
          }
          onLeave={() => {
            // Dispatch leave for all bubble peers to clear the bubble
            webrtc.bubblePeers.forEach((peerId) => {
              window.dispatchEvent(
                new CustomEvent("space-station:proximity-leave", {
                  detail: { peerId },
                }),
              );
            });
          }}
        />
      )}

      {/* ── Bubble apps panel (bottom-right) ── */}
      {!loading && (
        <BubbleAppsPanel
          bubblePeers={webrtc.bubblePeers}
          peers={webrtc.peers}
          bubbleLocked={webrtc.bubbleLocked}
          onToggleLock={webrtc.toggleBubbleLock}
          onConnectMyInstance={() => {
            toast.info("Conecte seu WhatsApp em Configurações → Integrações", {
              action: {
                label: "Abrir",
                onClick: () => window.open("/settings", "_blank"),
              },
            });
          }}
          onOpenChat={(peerUserId) => {
            setChatPeerId(peerUserId);
            setChatPeerName(webrtc.peers.get(peerUserId)?.name ?? null);
          }}
          onOpenApp={(app: BubbleApp, peerUserId) => {
            toast.info(
              `${app} → ${webrtc.peers.get(peerUserId)?.name ?? "peer"} — em implementação`,
            );
          }}
        />
      )}

      {/* ── Bubble chat drawer ── */}
      <BubbleChatPanel
        open={!!chatPeerId}
        peerUserId={chatPeerId}
        peerName={
          chatPeerId
            ? (webrtc.peers.get(chatPeerId)?.name ?? chatPeerName ?? null)
            : null
        }
        onClose={() => {
          setChatPeerId(null);
          setChatPeerName(null);
        }}
      />

      {/* ── Video overlay (bottom-right) ── */}
      {!loading && (
        <VideoOverlay
          localStream={webrtc.localStream}
          localScreenStream={webrtc.screenStream}
          localMicOn={webrtc.micOn}
          localCamOn={webrtc.camOn}
          localScreenOn={webrtc.screenOn}
          localName={userName}
          localImage={userImage}
          peers={webrtc.peers}
          onPiPToggle={setPipActive}
          sinkId={webrtc.selectedOutput}
        />
      )}

      {/* ── HUD — nick (top-left) + controls (bottom-center) ── */}
      {!loading && (
        <>
          <div className="absolute top-3 left-4 z-10">
            <a
              href={`/space/${nick}`}
              title="Abrir Spacehome"
              className="h-[52px] flex items-center bg-black/50 backdrop-blur-sm rounded-2xl px-4 text-xs text-slate-300 hover:bg-black/60 hover:text-white transition-colors cursor-pointer"
            >
              <span className="font-mono text-indigo-400">@{nick}</span>&nbsp;·
              Space Station
            </a>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-400 text-center">
              ← ↑ ↓ → para mover
            </div>
          </div>
        </>
      )}

      {/* ── Top-right: exit ──
          Botão "Configurar" removido — agora a configuração abre via
          ícone "Personalizar avatar" no MediaBar (UserRound). */}
      <div className="absolute top-3 right-4 z-10 flex gap-2">
        <button
          type="button"
          className="h-[52px] flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-2xl px-4 text-xs font-medium text-white hover:bg-black/60 transition-all"
          onClick={() => (window.location.href = `/station/${nick}`)}
        >
          <X className="h-4 w-4" />
          Sair
        </button>
      </div>

      {/* ── Galaxy explorer (side panel) ── */}
      {galaxyOpen && !settingsOpen && (
        <div className="absolute inset-y-0 right-0 z-20 w-80 bg-slate-900/95 backdrop-blur-sm border-l border-white/10 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-400" />
              <h2 className="text-white font-semibold">Galáxia NASA</h2>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setGalaxyOpen(false)}
              className="text-slate-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <StationExplorer />
        </div>
      )}

      {/* ── Zoom controls (bottom-right) ── */}
      {!loading && (
        <div className="absolute bottom-5 right-5 z-10 flex flex-col items-center gap-1">
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= zoomMax}
            className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/10 disabled:opacity-30 transition-all backdrop-blur-sm"
            title="Zoom in (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomReset}
            className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-all backdrop-blur-sm"
            title="Resetar zoom"
          >
            <span className="text-[9px] font-bold leading-none tabular-nums">
              {zoomPct}%
            </span>
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= zoomMin}
            className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/10 disabled:opacity-30 transition-all backdrop-blur-sm"
            title="Zoom out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (!document.fullscreenElement)
                document.documentElement.requestFullscreen();
              else document.exitFullscreen();
            }}
            className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-all backdrop-blur-sm mt-1"
            title="Tela cheia"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCreditsOpen((o) => !o)}
            className="w-9 h-9 rounded-xl bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-all backdrop-blur-sm"
            title="Créditos e licenças (CC BY-SA)"
          >
            <span className="text-[13px] leading-none font-semibold">©</span>
          </button>
        </div>
      )}

      {/* ── Screen share overlay (visible to all in bubble) ── */}
      {!loading && (
        <ScreenShareOverlay
          localScreenStream={webrtc.screenStream}
          localScreenOn={webrtc.screenOn}
          localName={userName}
          peers={webrtc.peers}
        />
      )}

      {/* ── Share panel ── */}
      {shareOpen && !loading && (
        <SharePanel nick={nick} onClose={() => setShareOpen(false)} />
      )}

      {/* ── Credits / Attribution panel (CC BY-SA 3.0) ── */}
      {creditsOpen && <CreditsPanel onClose={() => setCreditsOpen(false)} />}

      {/* ── Avatar personalization panel (available to ALL users incl. guests) ── */}
      {avatarPanelOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl h-[70vh] max-h-[620px]">
            <WokaAvatarPanel
              avatarConfig={avatarConfig}
              onChange={(partial) => {
                // Merge into current avatar state — the useEffect at the top
                // of SpaceGame persists this to localStorage automatically.
                setAvatarConfig(
                  (prev) => ({ ...prev, ...partial }) as AvatarConfig,
                );
              }}
              onClose={() => setAvatarPanelOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Publish Template modal (owner only, triggered by MapEditor) ── */}
      {isOwner && (
        <PublishTemplateModal stationId={stationId} worldConfig={worldConfig} />
      )}

      {/* ── World settings panel ── */}
      {settingsOpen && (
        <WorldSettingsPanel
          stationId={stationId}
          worldConfig={worldConfig}
          avatarConfig={avatarConfig}
          nick={nick}
          userImage={userImage}
          onClose={() => setSettingsOpen(false)}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
