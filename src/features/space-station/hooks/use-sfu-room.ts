"use client";

/**
 * Hook de mídia (áudio/vídeo/tela) do mundo via LiveKit SFU.
 *
 * Substitui `use-webrtc.ts` (mesh P2P), expondo a MESMA fachada para que
 * `space-game.tsx` e os overlays (MediaBar, VideoOverlay, ProximityBar,
 * ScreenShareOverlay, MediaSettingsPanel, BubbleAppsPanel) não precisem
 * conhecer o transporte.
 *
 * Por que SFU:
 *   - O mesh não escalava além de ~6 pessoas (N² conexões) e exigia TURN
 *     próprio. LiveKit Cloud já oferece TURN/relay, resolvendo a classe
 *     inteira dos bugs "não ouço/não falo em rede corporativa/móvel".
 *   - Toggles de mic/cam/tela viram chamadas únicas — adeus glare, perfect
 *     negotiation manual e renegociação por `onnegotiationneeded`.
 *
 * Nesta fase 1 não há subscrição seletiva por proximidade (todos numa sala
 * se ouvem). A bolha de proximidade volta a fazer sentido na fase 2 quando
 * conectarmos os eventos `space-station:proximity-enter/leave` da WorldScene
 * ao `RemoteTrackPublication.setSubscribed(...)`.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  connectRoom,
  type Room,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "@/lib/livekit/client";
import { attachAudioUnlock, type AudioUnlockState } from "@/lib/media/audio-unlock";
import { resolveRemoteSpriteUrl } from "../utils/sprite-defaults";
import type { RemotePeer } from "./use-webrtc";

interface UseSfuRoomOptions {
  /** Quando vazio, o hook fica idle (não conecta). */
  token: string | null;
  /** wsUrl retornado pelo backend (mesmo do LIVEKIT_WS_URL). */
  wsUrl: string | null;
  /** ID estável do usuário local (mesmo do `effectiveUserId` em space-game). */
  userId: string;
  userName: string;
  userImage?: string | null;
}

export interface UseSfuRoomReturn {
  // Estado de mídia local
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  camError: string | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Peers remotos
  peers: Map<string, RemotePeer>;

  // Devices
  devices: {
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
    output: MediaDeviceInfo[];
  };
  selectedAudio: string;
  selectedVideo: string;
  selectedOutput: string;
  setSelectedAudio: (id: string) => void;
  setSelectedVideo: (id: string) => void;
  setSelectedOutput: (id: string) => void;
  applyDeviceChange: () => Promise<void>;

  // Toggles
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  toggleScreen: () => Promise<void>;

  // UI flags
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Communication bubble (Fase 2 acopla com proximidade real)
  bubblePeers: Set<string>;
  bubbleLocked: boolean;
  toggleBubbleLock: () => void;

  // Sinais de saúde da conexão
  audioBlocked: boolean;
  connectionState: "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
}

const PIXEL_ASTRONAUT_SENTINEL = "pixel_astronaut";

export function useSfuRoom({
  token,
  wsUrl,
  userId,
  userName,
  userImage,
}: UseSfuRoomOptions): UseSfuRoomReturn {
  // ── Estado público ───────────────────────────────────────────────────────
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const [devices, setDevices] = useState<UseSfuRoomReturn["devices"]>({
    audio: [],
    video: [],
    output: [],
  });
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bubbleLocked, setBubbleLocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [connectionState, setConnectionState] =
    useState<UseSfuRoomReturn["connectionState"]>("idle");

  // Bubble = todos os peers conectados, na Fase 1 (sem proximidade).
  // Derivada de `peers` via useEffect abaixo.
  const [bubblePeers, setBubblePeers] = useState<Set<string>>(new Set());

  // ── Refs (evitar closures estale e re-renders) ──────────────────────────
  const roomRef = useRef<Room | null>(null);
  const audioUnlockDisposeRef = useRef<(() => void) | null>(null);
  const micOnRef = useRef(false);
  const camOnRef = useRef(false);
  const screenOnRef = useRef(false);
  const selectedAudioRef = useRef("");
  const selectedVideoRef = useRef("");
  const selectedOutputRef = useRef("");
  const bubbleLockedRef = useRef(false);

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);
  useEffect(() => {
    screenOnRef.current = screenOn;
  }, [screenOn]);
  useEffect(() => {
    selectedAudioRef.current = selectedAudio;
  }, [selectedAudio]);
  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);
  useEffect(() => {
    selectedOutputRef.current = selectedOutput;
  }, [selectedOutput]);
  useEffect(() => {
    bubbleLockedRef.current = bubbleLocked;
  }, [bubbleLocked]);

  // ── Enumera devices (precisa de permissão prévia pra labels) ────────────
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audio: all.filter((d) => d.kind === "audioinput"),
        video: all.filter((d) => d.kind === "videoinput"),
        output: all.filter((d) => d.kind === "audiooutput"),
      });
    } catch {
      /* permissão ainda não concedida */
    }
  }, []);

  // ── Reconstrução dos peers a partir do estado atual da Room ─────────────
  const rebuildPeers = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = new Map<string, RemotePeer>();
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      next.set(p.identity, snapshotRemotePeer(p));
    });
    // Preserva spriteUrl/nick/image que vieram do Pusher (presence).
    setPeers((prev) => {
      const merged = new Map<string, RemotePeer>();
      next.forEach((peer, id) => {
        const old = prev.get(id);
        merged.set(id, {
          ...peer,
          name: old?.name ?? peer.name,
          nick: old?.nick ?? peer.nick,
          image: old?.image ?? peer.image,
          spriteUrl: old?.spriteUrl ?? peer.spriteUrl,
        });
      });
      return merged;
    });
  }, []);

  // ── Conexão à Room ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !wsUrl) {
      setConnectionState("idle");
      return;
    }

    let cancelled = false;
    let activeRoom: Room | null = null;
    setConnectionState("connecting");
    setCamError(null);

    (async () => {
      try {
        const room = await connectRoom({
          token,
          url: wsUrl,
          roomOptions: {
            adaptiveStream: true,
            dynacast: true,
          },
        });
        if (cancelled) {
          room.disconnect();
          return;
        }
        activeRoom = room;
        roomRef.current = room;

        // ── Audio unlock (fix "não ouço" autoplay bloqueado) ───────────────
        audioUnlockDisposeRef.current = attachAudioUnlock(
          room,
          ({ blocked }: AudioUnlockState) => setAudioBlocked(blocked),
        );

        // ── Estado de conexão ─────────────────────────────────────────────
        const onConnState = () => {
          const s = String(room.state);
          if (s === "connected") setConnectionState("connected");
          else if (s === "connecting") setConnectionState("connecting");
          else if (s === "reconnecting") setConnectionState("reconnecting");
          else setConnectionState("disconnected");
        };
        room.on("connectionStateChanged" as never, onConnState as never);
        onConnState();

        // ── Participantes ─────────────────────────────────────────────────
        const refreshAll = () => rebuildPeers();
        room.on("participantConnected" as never, refreshAll as never);
        room.on("participantDisconnected" as never, refreshAll as never);
        room.on("trackSubscribed" as never, refreshAll as never);
        room.on("trackUnsubscribed" as never, refreshAll as never);
        room.on("trackMuted" as never, refreshAll as never);
        room.on("trackUnmuted" as never, refreshAll as never);
        room.on("trackPublished" as never, refreshAll as never);
        room.on("trackUnpublished" as never, refreshAll as never);
        room.on("localTrackPublished" as never, refreshAll as never);
        room.on("localTrackUnpublished" as never, refreshAll as never);
        refreshAll();

        // ── Devices ───────────────────────────────────────────────────────
        const onDevicesChange = () => {
          void refreshDevices();
        };
        room.on("mediaDevicesChanged" as never, onDevicesChange as never);
        await refreshDevices();
      } catch (err) {
        if (!cancelled) {
          console.error("[use-sfu-room] connect failed:", err);
          setCamError(
            err instanceof Error
              ? err.message
              : "Erro ao conectar ao servidor de mídia.",
          );
          setConnectionState("disconnected");
        }
      }
    })();

    return () => {
      cancelled = true;
      audioUnlockDisposeRef.current?.();
      audioUnlockDisposeRef.current = null;
      if (activeRoom) {
        activeRoom.disconnect();
      }
      roomRef.current = null;
      setPeers(new Map());
      setLocalStream(null);
      setScreenStream(null);
      setMicOn(false);
      setCamOn(false);
      setScreenOn(false);
    };
  }, [token, wsUrl, rebuildPeers, refreshDevices]);

  // ── Sincroniza bubblePeers com peers (Fase 1: bubble = todos) ───────────
  useEffect(() => {
    if (bubbleLockedRef.current) return;
    setBubblePeers(new Set(peers.keys()));
  }, [peers]);

  // ── Toggle Mic ──────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOnRef.current;
    try {
      await room.localParticipant.setMicrophoneEnabled(
        next,
        selectedAudioRef.current
          ? { deviceId: { exact: selectedAudioRef.current } }
          : undefined,
      );
      setMicOn(next);
      setCamError(null);
      void refreshDevices();
      // Reconstrói localStream a partir das tracks publicadas.
      setLocalStream(buildLocalStream(room));
    } catch (err) {
      console.error("[use-sfu-room] toggleMic:", err);
      setCamError(humanizeMediaError(err));
    }
  }, [refreshDevices]);

  // ── Toggle Cam ──────────────────────────────────────────────────────────
  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOnRef.current;
    try {
      await room.localParticipant.setCameraEnabled(
        next,
        selectedVideoRef.current
          ? { deviceId: { exact: selectedVideoRef.current } }
          : undefined,
      );
      setCamOn(next);
      setCamError(null);
      void refreshDevices();
      setLocalStream(buildLocalStream(room));
    } catch (err) {
      console.error("[use-sfu-room] toggleCam:", err);
      setCamError(humanizeMediaError(err));
    }
  }, [refreshDevices]);

  // ── Toggle Screen Share ─────────────────────────────────────────────────
  const toggleScreen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenOnRef.current;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
      setScreenStream(next ? buildLocalScreenStream(room) : null);
    } catch (err) {
      console.error("[use-sfu-room] toggleScreen:", err);
      setCamError(humanizeMediaError(err));
    }
  }, []);

  // ── Apply device change (input/output) ──────────────────────────────────
  const applyDeviceChange = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      if (selectedAudioRef.current) {
        await room.switchActiveDevice("audioinput", selectedAudioRef.current);
      }
      if (selectedVideoRef.current) {
        await room.switchActiveDevice("videoinput", selectedVideoRef.current);
      }
      if (selectedOutputRef.current) {
        await room.switchActiveDevice("audiooutput", selectedOutputRef.current);
      }
      setLocalStream(buildLocalStream(room));
    } catch (err) {
      console.error("[use-sfu-room] applyDeviceChange:", err);
      setCamError(humanizeMediaError(err));
    }
  }, []);

  const toggleBubbleLock = useCallback(() => {
    setBubbleLocked((v) => !v);
  }, []);

  // ── Integração com presence (Pusher) — popula sprite/name/image ─────────
  // O `use-world-presence` já dispara `space-station:peer-sprite` quando
  // alguém entra. Reusamos esse canal pra enriquecer os peers do SFU sem
  // duplicar lógica.
  useEffect(() => {
    const onPeerSprite = (e: Event) => {
      const { userId: pid, name, nick, spriteUrl } = (e as CustomEvent).detail as {
        userId: string;
        name: string;
        nick?: string | null;
        spriteUrl: string | null;
      };
      if (!pid || pid === userId) return;
      const resolvedSprite = resolveRemoteSpriteUrl(
        spriteUrl === PIXEL_ASTRONAUT_SENTINEL ? null : spriteUrl,
        pid,
      );
      setPeers((prev) => {
        const existing = prev.get(pid);
        const next = new Map(prev);
        next.set(pid, {
          userId: pid,
          name,
          nick: nick ?? existing?.nick ?? null,
          image: existing?.image ?? null,
          spriteUrl: resolvedSprite,
          stream: existing?.stream ?? null,
          screenStream: existing?.screenStream,
          micOn: existing?.micOn ?? false,
          camOn: existing?.camOn ?? false,
          screenOn: existing?.screenOn ?? false,
        });
        return next;
      });
    };

    window.addEventListener("space-station:peer-sprite", onPeerSprite);
    return () => {
      window.removeEventListener("space-station:peer-sprite", onPeerSprite);
    };
  }, [userId]);

  // userImage do user local — não tocamos no peers (é o local), só registramos
  // pra evitar lint sobre prop não usada na Fase 1. Útil em fases futuras pra
  // metadata personalizada do localParticipant.
  void userImage;
  void userName;

  return {
    micOn,
    camOn,
    screenOn,
    camError,
    localStream,
    screenStream,
    peers,
    devices,
    selectedAudio,
    selectedVideo,
    selectedOutput,
    setSelectedAudio,
    setSelectedVideo,
    setSelectedOutput,
    applyDeviceChange,
    toggleMic,
    toggleCam,
    toggleScreen,
    settingsOpen,
    setSettingsOpen,
    bubblePeers,
    bubbleLocked,
    toggleBubbleLock,
    audioBlocked,
    connectionState,
  };
}

// ─── Helpers internos ───────────────────────────────────────────────────────

/**
 * Constrói um MediaStream agregando as tracks de mic+cam publicadas pelo
 * `localParticipant`. Usado só pra preview local (componentes esperam um
 * MediaStream agregado, mesma forma que o mesh entregava).
 */
function buildLocalStream(room: Room): MediaStream | null {
  const tracks: MediaStreamTrack[] = [];
  room.localParticipant.trackPublications.forEach((pub) => {
    const sourceStr = String(pub.source ?? "");
    if (sourceStr === "screen_share" || sourceStr === "screen_share_audio") {
      return;
    }
    const t = pub.track?.mediaStreamTrack;
    if (t) tracks.push(t);
  });
  if (tracks.length === 0) return null;
  return new MediaStream(tracks);
}

function buildLocalScreenStream(room: Room): MediaStream | null {
  const tracks: MediaStreamTrack[] = [];
  room.localParticipant.trackPublications.forEach((pub) => {
    const sourceStr = String(pub.source ?? "");
    if (sourceStr !== "screen_share" && sourceStr !== "screen_share_audio") {
      return;
    }
    const t = pub.track?.mediaStreamTrack;
    if (t) tracks.push(t);
  });
  if (tracks.length === 0) return null;
  return new MediaStream(tracks);
}

/**
 * Foto de um `RemoteParticipant` em RemotePeer. Mic/cam/screen e streams
 * derivam das publicações; nome cai pra `name` do LiveKit (vem do token).
 * Os campos de sprite/image são preenchidos via Pusher noutro effect.
 */
function snapshotRemotePeer(p: RemoteParticipant): RemotePeer {
  let micOn = false;
  let camOn = false;
  let screenOn = false;
  const mediaTracks: MediaStreamTrack[] = [];
  const screenTracks: MediaStreamTrack[] = [];

  p.trackPublications.forEach((pub) => {
    const rpub = pub as RemoteTrackPublication;
    const sourceStr = String(rpub.source ?? "");
    const isScreen =
      sourceStr === "screen_share" || sourceStr === "screen_share_audio";

    if (sourceStr === "microphone") micOn = !rpub.isMuted && rpub.isSubscribed;
    if (sourceStr === "camera") camOn = !rpub.isMuted && rpub.isSubscribed;
    if (isScreen) screenOn = !rpub.isMuted && rpub.isSubscribed;

    const t = rpub.track?.mediaStreamTrack;
    if (!t) return;
    (isScreen ? screenTracks : mediaTracks).push(t);
  });

  const stream =
    mediaTracks.length > 0 ? new MediaStream(mediaTracks) : null;
  const screenStream =
    screenTracks.length > 0 ? new MediaStream(screenTracks) : null;

  return {
    userId: p.identity,
    name: p.name || p.identity,
    nick: null,
    image: null,
    spriteUrl: null,
    stream,
    screenStream,
    micOn,
    camOn,
    screenOn,
  };
}

function humanizeMediaError(err: unknown): string {
  if (!(err instanceof Error)) return "Erro ao acessar mídia.";
  const name = (err as Error).name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Permissão negada — libere o microfone/câmera nas configurações do navegador.";
  if (name === "NotFoundError")
    return "Nenhum dispositivo encontrado.";
  if (name === "NotReadableError")
    return "Dispositivo em uso por outro aplicativo.";
  return err.message || "Erro ao acessar mídia.";
}
