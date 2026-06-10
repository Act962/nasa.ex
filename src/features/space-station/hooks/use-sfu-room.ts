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
import {
  isDeviceUnavailableError,
  resolvePreferredDeviceId,
} from "../utils/media-devices";
import { useMediaDeviceStore } from "./use-media-device-store";
import { useMediaDevices, type EnumeratedDevices } from "./use-media-devices";
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

  // Devices — seleção persistida em useMediaDeviceStore (localStorage)
  devices: EnumeratedDevices;
  selectedAudio: string;
  selectedVideo: string;
  selectedOutput: string;
  setSelectedAudio: (id: string) => void;
  setSelectedVideo: (id: string) => void;
  setSelectedOutput: (id: string) => void;
  applyDeviceChange: () => Promise<void>;
  /** Prime de permissão pra liberar labels/saídas no painel (clique explícito). */
  requestDevicePermissions: () => Promise<void>;

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bubbleLocked, setBubbleLocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [connectionState, setConnectionState] =
    useState<UseSfuRoomReturn["connectionState"]>("idle");

  // Bubble = todos os peers conectados, na Fase 1 (sem proximidade).
  // Derivada de `peers` via useEffect abaixo.
  const [bubblePeers, setBubblePeers] = useState<Set<string>>(new Set());

  // ── Seleção de devices — persistida (localStorage) e compartilhada com o
  // transporte mesh, então sobrevive a reload e à troca SFU↔mesh.
  const audioInputId = useMediaDeviceStore((state) => state.audioInputId);
  const videoInputId = useMediaDeviceStore((state) => state.videoInputId);
  const audioOutputId = useMediaDeviceStore((state) => state.audioOutputId);
  const setAudioInputId = useMediaDeviceStore((state) => state.setAudioInputId);
  const setVideoInputId = useMediaDeviceStore((state) => state.setVideoInputId);
  const setAudioOutputId = useMediaDeviceStore((state) => state.setAudioOutputId);
  const { devices, refreshDevices, getCurrentDevices, requestDevicePermissions } =
    useMediaDevices();

  // ── Refs (evitar closures estale e re-renders) ──────────────────────────
  const roomRef = useRef<Room | null>(null);
  const audioUnlockDisposeRef = useRef<(() => void) | null>(null);
  const micOnRef = useRef(false);
  const camOnRef = useRef(false);
  const screenOnRef = useRef(false);
  // Ids que já estiveram na sala SFU — pra remover quem saiu sem apagar peers
  // que vieram só do Pusher (guests / presence antes de entrar no SFU).
  const sfuIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);
  useEffect(() => {
    screenOnRef.current = screenOn;
  }, [screenOn]);

  // ── Reconstrução dos peers a partir do estado atual da Room ─────────────
  const rebuildPeers = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const currentSfuIds = new Set<string>();
    const snapshots = new Map<string, RemotePeer>();
    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      // A identity vem com sufixo por aba (`${accountId}:${sessionId}`), mas a
      // presença (Pusher) e os sprites são por usuário — casamos pelo accountId.
      // Duas abas do próprio usuário aparecem aqui; ignoramos a nossa (mesmo
      // accountId) pra não virar um "peer fantasma" de nós mesmos.
      const accountId = toAccountId(participant.identity);
      if (accountId === userId) return;
      currentSfuIds.add(accountId);
      snapshots.set(accountId, snapshotRemotePeer(participant, accountId));
    });
    setPeers((prev) => {
      // Mantém peers que vieram só do Pusher (presence) e ainda não entraram no
      // SFU — não apagamos só porque um evento do LiveKit disparou.
      const merged = new Map(prev);
      // Upsert dos participantes SFU atuais, preservando sprite/nick/image do
      // presence (Pusher).
      snapshots.forEach((peer, id) => {
        const old = prev.get(id);
        merged.set(id, {
          ...peer,
          name: old?.name ?? peer.name,
          nick: old?.nick ?? peer.nick,
          image: old?.image ?? peer.image,
          spriteUrl: old?.spriteUrl ?? peer.spriteUrl,
        });
      });
      // Remove quem ESTAVA no SFU mas saiu — sem mexer nos peers só-Pusher.
      sfuIdsRef.current.forEach((id) => {
        if (!currentSfuIds.has(id)) merged.delete(id);
      });
      return merged;
    });
    sfuIdsRef.current = currentSfuIds;
  }, [userId]);

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
            // adaptiveStream/dynacast exigem track.attach() pro LiveKit
            // observar a visibilidade dos elementos de vídeo. Os overlays
            // renderizam via `el.srcObject` (sem attach), então deixá-los ON
            // faz o SFU pausar o vídeo remoto (ninguém é "visto") → tela preta.
            // Mantemos OFF até migrar os overlays pra track.attach() (Fase 2+).
            adaptiveStream: false,
            dynacast: false,
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
          // "signalReconnecting" é o reconnect de sinalização do livekit-client;
          // tratamos como "reconnecting" pra mostrar o banner em vez de
          // "desconectado" durante uma recuperação transitória.
          else if (s === "reconnecting" || s === "signalReconnecting")
            setConnectionState("reconnecting");
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
        // Sincroniza o estado local de screen-share quando a track de tela é
        // despublicada — inclusive ao clicar em "Parar de compartilhar" na
        // barra nativa do browser (sem isso, screenOn travava em true e o
        // botão de tela ficava invertido).
        const onLocalUnpublished = (pub: unknown) => {
          const src = String((pub as { source?: unknown })?.source ?? "");
          if (src === "screen_share" || src === "screen_share_audio") {
            setScreenOn(false);
            setScreenStream(null);
          }
        };
        room.on("localTrackUnpublished" as never, onLocalUnpublished as never);
        refreshAll();

        // ── Devices ───────────────────────────────────────────────────────
        const onDevicesChange = () => {
          void refreshDevices();
        };
        room.on("mediaDevicesChanged" as never, onDevicesChange as never);
        await refreshDevices();

        // ── Reaplica o intent de mídia após (re)conectar ──────────────────
        // Numa reconexão (token/wsUrl mudaram → Room nova) o mic/cam precisam
        // voltar ao estado que o usuário deixou. Sem isto a track ficava
        // despublicada apesar do botão na MediaBar continuar "ligado" — o
        // usuário falava no mudo. Só restauramos mic/cam; screen-share exige
        // novo gesto/seletor, então não é restaurado. No 1º connect os refs
        // são `false`, então isto é no-op (não forçamos mic ligado na entrada).
        if (!cancelled && (micOnRef.current || camOnRef.current)) {
          const storedPreferences = useMediaDeviceStore.getState();
          const currentDevices = getCurrentDevices();
          try {
            if (micOnRef.current) {
              await enableMicrophone(
                room,
                true,
                resolvePreferredDeviceId(
                  storedPreferences.audioInputId,
                  currentDevices.audio,
                ),
              );
            }
            if (camOnRef.current) {
              await enableCamera(
                room,
                true,
                resolvePreferredDeviceId(
                  storedPreferences.videoInputId,
                  currentDevices.video,
                ),
              );
            }
            if (!cancelled) setLocalStream(buildLocalStream(room));
          } catch (err) {
            console.error(
              "[use-sfu-room] restaurar intent de mídia falhou:",
              err,
            );
          }
        }
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
      // NÃO zeramos `peers` aqui: numa reconexão (token/wsUrl novos) isso apagava
      // os peers vindos só da presença (Pusher) — guests/usuários que ainda não
      // publicaram no SFU — e eles só reapareceriam no próximo `peer-sprite`
      // (emitido em join, não periodicamente), sumindo do mapa/overlays. O
      // `rebuildPeers` reconcilia sozinho: upserta os participantes atuais e
      // remove os que saíram do SFU via `sfuIdsRef`, preservando os só-presença.
      setLocalStream(null);
      setScreenStream(null);
      // NÃO resetamos micOn/camOn: o intent do usuário é preservado (refs) e
      // reaplicado após reconectar (bloco "reaplica o intent" acima). Resetar
      // aqui fazia o botão da MediaBar voltar pra "desligado" numa reconexão e
      // o usuário falava com o mic mudo achando que estava ligado. Screen-share
      // não sobrevive a uma Room nova (exige novo gesto), então segue resetado.
      setScreenOn(false);
    };
  }, [token, wsUrl, rebuildPeers, refreshDevices, getCurrentDevices]);

  // ── Sincroniza bubblePeers com peers (Fase 1: bubble = todos) ───────────
  // Depende de `bubbleLocked` (estado, não ref) pra re-sincronizar ao destravar.
  useEffect(() => {
    if (bubbleLocked) return;
    setBubblePeers(new Set(peers.keys()));
  }, [peers, bubbleLocked]);

  // ── Toggle Mic ──────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOnRef.current;
    // Só usa `exact` se o device persistido está na enumeração atual; se ele
    // sumiu (headset desconectado), cai no default sem apagar a preferência.
    const preferredAudioInputId = resolvePreferredDeviceId(
      useMediaDeviceStore.getState().audioInputId,
      getCurrentDevices().audio,
    );
    try {
      await enableMicrophone(room, next, preferredAudioInputId);
      setMicOn(next);
      setCamError(null);
      void refreshDevices();
      // Reconstrói localStream a partir das tracks publicadas.
      setLocalStream(buildLocalStream(room));
    } catch (err) {
      console.error("[use-sfu-room] toggleMic:", err);
      setCamError(humanizeMediaError(err));
    }
  }, [refreshDevices, getCurrentDevices]);

  // ── Toggle Cam ──────────────────────────────────────────────────────────
  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOnRef.current;
    const preferredVideoInputId = resolvePreferredDeviceId(
      useMediaDeviceStore.getState().videoInputId,
      getCurrentDevices().video,
    );
    try {
      await enableCamera(room, next, preferredVideoInputId);
      setCamOn(next);
      setCamError(null);
      void refreshDevices();
      setLocalStream(buildLocalStream(room));
    } catch (err) {
      console.error("[use-sfu-room] toggleCam:", err);
      setCamError(humanizeMediaError(err));
    }
  }, [refreshDevices, getCurrentDevices]);

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

  // ── Apply device change (inputs) ─────────────────────────────────────────
  // Lê direto do store (getState é síncrono) — o padrão antigo de refs
  // espelhadas via useEffect fazia o PRIMEIRO apply usar o device anterior.
  const applyDeviceChange = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const storedPreferences = useMediaDeviceStore.getState();
    const currentDevices = getCurrentDevices();
    const preferredAudioInputId = resolvePreferredDeviceId(
      storedPreferences.audioInputId,
      currentDevices.audio,
    );
    const preferredVideoInputId = resolvePreferredDeviceId(
      storedPreferences.videoInputId,
      currentDevices.video,
    );
    try {
      if (preferredAudioInputId) {
        await room.switchActiveDevice("audioinput", preferredAudioInputId);
      }
      if (preferredVideoInputId) {
        await room.switchActiveDevice("videoinput", preferredVideoInputId);
      }
      setLocalStream(buildLocalStream(room));
    } catch (err) {
      console.error("[use-sfu-room] applyDeviceChange:", err);
      setCamError(humanizeMediaError(err));
    }
  }, [getCurrentDevices]);

  // ── Saída de áudio (reativa) ─────────────────────────────────────────────
  // Hoje o LiveKit só aplica sinkId em elementos anexados via track.attach(),
  // que os overlays NÃO usam (renderizam via el.srcObject — ver comentário em
  // connectRoom). Quem garante a saída audível é o setSinkId do VideoOverlay.
  // Mantemos o switchActiveDevice como future-proofing pra quando a Fase 2+
  // migrar os overlays pro attach().
  useEffect(() => {
    const room = roomRef.current;
    if (!room || connectionState !== "connected") return;
    const preferredOutputId = resolvePreferredDeviceId(
      audioOutputId,
      getCurrentDevices().output,
    );
    if (!preferredOutputId) return;
    room.switchActiveDevice("audiooutput", preferredOutputId).catch(() => {
      /* device stale/sem suporte — saída efetiva segue via setSinkId */
    });
  }, [audioOutputId, connectionState, getCurrentDevices]);

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

  // ── Remoção de peers que saíram (presence Pusher) ───────────────────────
  // Cobre guests/peers que nunca entraram no SFU: `rebuildPeers` só remove quem
  // ESTEVE no SFU, então tratamos aqui quem veio só do presence.
  useEffect(() => {
    const onRemoteLeave = (e: Event) => {
      const { userId: pid } = (e as CustomEvent).detail as { userId: string };
      if (!pid) return;
      setPeers((prev) => {
        if (!prev.has(pid)) return prev;
        const next = new Map(prev);
        next.delete(pid);
        return next;
      });
    };
    window.addEventListener("space-station:remote-leave", onRemoteLeave);
    return () => {
      window.removeEventListener("space-station:remote-leave", onRemoteLeave);
    };
  }, []);

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
    selectedAudio: audioInputId,
    selectedVideo: videoInputId,
    selectedOutput: audioOutputId,
    setSelectedAudio: setAudioInputId,
    setSelectedVideo: setVideoInputId,
    setSelectedOutput: setAudioOutputId,
    applyDeviceChange,
    requestDevicePermissions,
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
 * Remove o sufixo de sessão da identity do LiveKit (`${accountId}:${sessionId}`
 * — ver join-world.ts) pra obter o id por usuário usado pela presença (Pusher)
 * e pelos sprites. Sem sufixo (convidado, token legado), devolve a string toda.
 */
function toAccountId(identity: string): string {
  const separatorIndex = identity.indexOf(":");
  return separatorIndex === -1 ? identity : identity.slice(0, separatorIndex);
}

/**
 * Liga/desliga o microfone honrando o device preferido, com fallback pro device
 * padrão quando o preferido sumiu (corrida enumeração×unplug). Compartilhado
 * pelo toggle e pela reaplicação de intent após reconectar.
 */
async function enableMicrophone(
  room: Room,
  enabled: boolean,
  preferredDeviceId: string | null,
): Promise<void> {
  try {
    await room.localParticipant.setMicrophoneEnabled(
      enabled,
      preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : undefined,
    );
  } catch (err) {
    // Corrida enumeração×unplug: device saiu depois da última enumeração.
    if (!enabled || !preferredDeviceId || !isDeviceUnavailableError(err)) {
      throw err;
    }
    await room.localParticipant.setMicrophoneEnabled(enabled);
  }
}

/** Igual a `enableMicrophone`, pra câmera. */
async function enableCamera(
  room: Room,
  enabled: boolean,
  preferredDeviceId: string | null,
): Promise<void> {
  try {
    await room.localParticipant.setCameraEnabled(
      enabled,
      preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : undefined,
    );
  } catch (err) {
    if (!enabled || !preferredDeviceId || !isDeviceUnavailableError(err)) {
      throw err;
    }
    await room.localParticipant.setCameraEnabled(enabled);
  }
}

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
function snapshotRemotePeer(
  p: RemoteParticipant,
  peerUserId: string,
): RemotePeer {
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
    userId: peerUserId,
    name: p.name || peerUserId,
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
