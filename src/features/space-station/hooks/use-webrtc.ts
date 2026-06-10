"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { resolveRemoteSpriteUrl } from "../utils/sprite-defaults";
import {
  isDeviceUnavailableError,
  resolvePreferredDeviceId,
} from "../utils/media-devices";
import { useMediaDeviceStore } from "./use-media-device-store";
import { useMediaDevices } from "./use-media-devices";

export interface RemotePeer {
  userId:       string;
  name:         string;
  nick?:        string | null;
  image:        string | null;
  spriteUrl?:   string | null;
  stream:       MediaStream | null;
  screenStream?: MediaStream | null;
  micOn:        boolean;
  camOn:        boolean;
  screenOn?:    boolean;
}

interface UseWebRTCOptions {
  stationId:  string;
  userId:     string;
  userName:   string;
  userImage?: string | null;
  /**
   * Quando `false`, o hook não conecta no Pusher de sinalização nem captura
   * mídia — usado como fallback quando o SFU (LiveKit) está ativo. Default
   * `true` pra preservar o comportamento legado.
   *
   * O hook continua sendo chamado (regra dos hooks de React) mas vira no-op.
   */
  enabled?:   boolean;
}

// STUN público sempre, TURN opcional via env (precisa em NAT simétrico
// — sintoma típico: peer entra na sala mas não vê/ouve outros).
//
// Configure em produção:
//   NEXT_PUBLIC_TURN_URL=turn:turn.example.com:3478
//   NEXT_PUBLIC_TURN_USERNAME=<user>
//   NEXT_PUBLIC_TURN_CREDENTIAL=<secret>
//
// Recomendo Twilio Network Traversal (~US$ 0.40/GB) ou self-hosted Coturn.
// Sem TURN, ~10-15% dos usuários de produção falham em conectar peer-to-peer.
const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USER = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CRED = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(TURN_URL && TURN_USER && TURN_CRED
    ? [{ urls: TURN_URL, username: TURN_USER, credential: TURN_CRED }]
    : []),
];

export function useWebRTC({ stationId, userId, userName, userImage, enabled = true }: UseWebRTCOptions) {
  // ── Server-side signaling helpers (no "Enable client events" needed) ───────
  function rtcPost(body: Record<string, unknown>) {
    fetch("/api/pusher/rtc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stationId, from: userId, ...body }),
    }).catch(() => {});
  }
  function triggerScreenServer(screenOn: boolean) {
    fetch("/api/pusher/world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "screen", stationId, userId, screenOn }),
    }).catch(() => {});
  }
  const [micOn, setMicOn]   = useState(false);
  const [camOn, setCamOn]   = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [peers, setPeers]   = useState<Map<string, RemotePeer>>(new Map());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Devices: enumeração compartilhada + seleção persistida (localStorage),
  // mesmo store do transporte SFU — sobrevive a reload e à troca SFU↔mesh.
  const audioInputId = useMediaDeviceStore((state) => state.audioInputId);
  const videoInputId = useMediaDeviceStore((state) => state.videoInputId);
  const audioOutputId = useMediaDeviceStore((state) => state.audioOutputId);
  const setAudioInputId = useMediaDeviceStore((state) => state.setAudioInputId);
  const setVideoInputId = useMediaDeviceStore((state) => state.setVideoInputId);
  const setAudioOutputId = useMediaDeviceStore((state) => state.setAudioOutputId);
  const { devices, refreshDevices, getCurrentDevices, requestDevicePermissions } =
    useMediaDevices();

  // Screen sharing
  const [screenOn,     setScreenOn]     = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenOnRef     = useRef(false);

  // Communication bubble
  const [bubblePeers,  setBubblePeers]  = useState<Set<string>>(new Set());
  const [bubbleLocked, setBubbleLocked] = useState(false);

  // Refs — sobrevivem re-renders sem disparar effects
  const localStreamRef  = useRef<MediaStream | null>(null);
  const pcsRef          = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef      = useRef<import("pusher-js").PresenceChannel | null>(null);
  const makingOfferRef  = useRef<Map<string, boolean>>(new Map());
  const micOnRef        = useRef(false);
  const camOnRef        = useRef(false);
  // Seleção de device é lida via useMediaDeviceStore.getState() (síncrono) —
  // sem refs espelhadas, sem stale closure.

  // Manter refs sincronizados com estado
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);
  useEffect(() => { camOnRef.current = camOn; }, [camOn]);
  useEffect(() => { screenOnRef.current = screenOn; }, [screenOn]);

  // ── Pusher presence channel ──────────────────────────────────────────────
  useEffect(() => {
    // No-op quando o transporte SFU (LiveKit) está ativo. Evita conexão Pusher
    // duplicada e custo de sinalização inútil enquanto a flag está OFF aqui.
    if (!enabled) return;
    let ch: import("pusher-js").Channel | null = null;
    let pusherRtcInstance: import("pusher-js").default | null = null;

    // Handlers de presença/sprite registrados SINCRONAMENTE (fora do setup()
    // async) pra que o cleanup os remova de forma determinística. Antes ficavam
    // dentro do setup() async e nunca eram removidos: com a flag `enabled`
    // alternando (SFU ligado), vazavam e disparavam conexões P2P fantasma +
    // POSTs em /api/pusher/rtc durante o modo SFU.
    // ── Conexão full-mesh dirigida por PRESENÇA (não por proximidade) ────────
    // O dono pediu: todos que entram na sala se escutam, sem "bolha". O
    // use-world-presence emite `space-station:remote-join` pra cada membro
    // existente (ao entrarmos) e pra cada novo membro; abrimos uma
    // RTCPeerConnection com todo mundo da sala. getOrCreatePC é idempotente, e a
    // oferta sai sozinha via onnegotiationneeded quando há track local — sem
    // gating por distância, sem o glare do createOffer explícito.
    const onRemoteJoin = (e: Event) => {
      const { userId: peerId, name, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name?: string; spriteUrl?: string | null;
      };
      if (!peerId || peerId === userId) return;
      void spriteUrl; // sprite/nick chegam enriquecidos via onPeerSprite
      getOrCreatePC(peerId, name ?? peerId, null, false);
      // Se já estamos compartilhando tela, re-anuncia pro recém-chegado.
      if (screenOnRef.current) {
        setTimeout(() => triggerScreenServer(true), 300);
      }
    };

    const onRemoteLeave = (e: Event) => {
      const { userId: peerId } = (e as CustomEvent).detail as { userId: string };
      if (!peerId || peerId === userId) return;
      closePeer(peerId);
    };

    const onPeerSprite = (e: Event) => {
      const { userId: pid, name, nick, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name: string; nick?: string | null; spriteUrl: string | null;
      };
      if (pid === userId) return;
      // Remaps "pixel_astronaut" → deterministic Pipoya so every remote
      // peer tile looks visually distinct (the base astronaut PNG is shared).
      const resolvedSprite = resolveRemoteSpriteUrl(spriteUrl, pid);
      let isNew = false;
      setPeers(prev => {
        const next = new Map(prev);
        const existing = next.get(pid);
        if (existing) {
          next.set(pid, { ...existing, name, nick: nick ?? existing.nick, spriteUrl: resolvedSprite });
        } else {
          isNew = true;
          next.set(pid, { userId: pid, name, nick: nick ?? null, image: null, spriteUrl: resolvedSprite, stream: null, micOn: false, camOn: false });
        }
        return next;
      });
      // Re-broadcast current media state so the new peer knows our status
      if (isNew) {
        rtcPost({ type: "media", micOn: micOnRef.current, camOn: camOnRef.current });
      }
    };

    window.addEventListener("space-station:remote-join",  onRemoteJoin);
    window.addEventListener("space-station:remote-leave", onRemoteLeave);
    window.addEventListener("space-station:peer-sprite",  onPeerSprite);

    async function setup() {
      const PusherClient = (await import("pusher-js")).default;
      pusherRtcInstance = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
        {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: `/api/pusher/auth?uid=${encodeURIComponent(userId)}`,
        },
      );
      // Use a PRIVATE (not presence) channel — WebRTC only needs server-triggered
      // events, not member tracking. This avoids duplicate presence members per
      // tab (one from useWorldPresence + one from here) which caused the
      // duplicate-character bug.
      ch = pusherRtcInstance.subscribe(`private-rtc-${stationId}`);
      channelRef.current = ch as import("pusher-js").PresenceChannel;

      // Perfect negotiation pattern — handles glare (simultaneous offers)
      ch.bind("rtc:offer", async (data: { sdp: RTCSessionDescriptionInit; from: string; fromName: string; fromImage: string | null; to?: string }) => {
        if (data.from === userId) return;
        if (data.to && data.to !== userId) return;
        const pc = getOrCreatePC(data.from, data.fromName ?? data.from, data.fromImage ?? null, false);
        // Polite peer (larger userId) yields during glare; impolite peer ignores conflicting offer
        const polite = userId > data.from;
        const makingOffer = makingOfferRef.current.get(data.from) ?? false;
        const offerCollision = makingOffer || pc.signalingState !== "stable";
        const ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;
        try {
          if (offerCollision) {
            // Rollback local offer and accept remote offer
            await pc.setLocalDescription({ type: "rollback" } as RTCLocalSessionDescriptionInit);
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          rtcPost({ type: "answer", to: data.from, sdp: answer });
        } catch (err) {
          console.warn("[useWebRTC] offer handling error:", err);
        }
      });

      ch.bind("rtc:answer", async (data: { sdp: RTCSessionDescriptionInit; from: string; to: string }) => {
        if (data.to !== userId) return;
        const pc = pcsRef.current.get(data.from);
        if (!pc) return;
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          }
        } catch (err) {
          console.warn("[useWebRTC] answer handling error:", err);
        }
      });

      ch.bind("rtc:ice", async (data: { candidate: RTCIceCandidateInit; from: string; to: string }) => {
        if (data.to !== userId) return;
        const pc = pcsRef.current.get(data.from);
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch { /* stale */ }
        }
      });

      ch.bind("rtc:media", (data: { from: string; micOn: boolean; camOn: boolean }) => {
        if (data.from === userId) return;
        setPeers(prev => {
          const next = new Map(prev);
          const peer = next.get(data.from);
          if (peer) next.set(data.from, { ...peer, micOn: data.micOn, camOn: data.camOn });
          return next;
        });
      });

      ch.bind("world:screen", (data: { userId: string; screenOn: boolean }) => {
        if (data.userId === userId) return;
        setPeers(prev => {
          const next = new Map(prev);
          const peer = next.get(data.userId);
          if (peer) next.set(data.userId, {
            ...peer,
            screenOn: data.screenOn,
            screenStream: data.screenOn ? peer.screenStream : null,
          });
          return next;
        });
      });

    }

    setup();
    refreshDevices();

    return () => {
      window.removeEventListener("space-station:remote-join",  onRemoteJoin);
      window.removeEventListener("space-station:remote-leave", onRemoteLeave);
      window.removeEventListener("space-station:peer-sprite",  onPeerSprite);
      ch?.unsubscribe();
      pusherRtcInstance?.disconnect();
      pusherRtcInstance = null;
      pcsRef.current.forEach(pc => pc.close());
      pcsRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, userId, enabled]);

  // ── bubblePeers = todos os peers da sala (somente UI) ─────────────────────
  // A bolha NÃO gateia mais áudio: todo mundo na sala se ouve. Este set só
  // alimenta ProximityBar/BubbleAppsPanel. Respeita bubbleLocked (congela o set
  // exibido enquanto travado).
  useEffect(() => {
    if (bubbleLocked) return;
    setBubblePeers(new Set(peers.keys()));
  }, [peers, bubbleLocked]);

  // ── RTCPeerConnection ────────────────────────────────────────────────────
  function getOrCreatePC(peerId: string, peerName: string, peerImage: string | null, _isInitiator: boolean): RTCPeerConnection {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(peerId, pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) rtcPost({ type: "ice", to: peerId, candidate });
    };

    // ── Negociação: a ÚNICA fonte de oferta é onnegotiationneeded ────────────
    // Antes havia DUAS fontes: createOffer explícito ao entrar na proximidade +
    // onnegotiationneeded disparado pelo addTrack. As duas ofertas quase
    // simultâneas geravam glare e o rollback caseiro às vezes deixava o
    // transceiver de áudio unidirecional → "um ouve, o outro não, e vice-versa".
    // Agora só onnegotiationneeded oferta; o glare é resolvido no receptor
    // (polite/impolite no handler rtc:offer) — padrão "perfect negotiation".
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(peerId, true);
        // setLocalDescription() sem argumento = createOffer + setLocalDescription
        // atômico (sem janela de corrida entre os dois passos). O browser só
        // dispara negotiationneeded quando o estado está "stable", então não há
        // guarda manual de signalingState a fazer aqui — fazer isso poderia
        // dropar a renegociação de um toggle de mic/cam.
        await pc.setLocalDescription();
        if (pc.localDescription) {
          rtcPost({ type: "offer", to: peerId, fromName: userName, fromImage: userImage ?? null, sdp: pc.localDescription });
        }
      } catch (err) {
        console.warn("[useWebRTC] onnegotiationneeded error:", err);
      } finally {
        makingOfferRef.current.set(peerId, false);
      }
    };

    // Tracks adicionadas DEPOIS dos handlers, pra que o primeiro
    // negotiationneeded (disparado pelo addTrack) já encontre onnegotiationneeded
    // setado e gere a oferta inicial.
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    screenStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, screenStreamRef.current!));

    pc.ontrack = ({ streams, track }) => {
      const incomingStream = streams[0];
      if (!incomingStream) return;

      // Detect screen track by: (1) server signal already set screenOn, OR
      // (2) track label contains "screen"/"window"/"tab" (Chrome display media), OR
      // (3) peer already tem stream principal de câmera/audio E o stream que
      //     chega é DIFERENTE (id ≠) — sinal de 2º MediaStream = screen.
      const labelIsScreen = track.kind === "video" && (
        track.label?.toLowerCase().includes("screen") ||
        track.label?.toLowerCase().includes("window") ||
        track.label?.toLowerCase().includes("tab:")
      );

      setPeers(prev => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        const isScreenTrack = track.kind === "video" && (
          existing?.screenOn ||
          labelIsScreen ||
          (existing?.stream != null && existing.stream.id !== incomingStream.id)
        );

        if (isScreenTrack) {
          next.set(peerId, {
            ...(existing ?? { userId: peerId, name: peerName, image: peerImage, stream: null, micOn: true, camOn: false, spriteUrl: null }),
            screenStream: incomingStream,
            screenOn: true,
          });
        } else {
          // BUG FIX: o código antigo fazia
          //   `stream: track.kind !== "video" ? (existing?.stream ?? null) : stream`
          // — pra tracks de áudio descartava o streams[0] que chegou. Resultado:
          // peer só-com-mic (ou áudio chegando antes do vídeo) ficava com
          // stream=null pra sempre e o áudio nunca tocava.
          // Agora sempre armazenamos o incomingStream — é o MESMO MediaStream
          // pra todas as tracks do mesmo peer (mic+cam), então atualizar com
          // ele é seguro independentemente da ordem de chegada.
          next.set(peerId, {
            userId: peerId, name: peerName, image: peerImage,
            stream: incomingStream,
            screenStream: existing?.screenStream ?? null,
            screenOn: existing?.screenOn ?? false,
            micOn: existing?.micOn ?? true,
            camOn: track.kind === "video" ? true : (existing?.camOn ?? false),
            spriteUrl: existing?.spriteUrl,
          });
        }
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pcsRef.current.delete(peerId);
        // Limpa o flag de glare junto com a PC: senão, ao reconectar com o mesmo
        // peerId, um makingOffer=true obsoleto faria o handler rtc:offer tratar
        // uma oferta válida como glare e ignorá-la → áudio unidirecional.
        makingOfferRef.current.delete(peerId);
        setPeers(prev => { const n = new Map(prev); n.delete(peerId); return n; });
      }
    };

    setPeers(prev => {
      if (prev.has(peerId)) return prev;
      const next = new Map(prev);
      next.set(peerId, { userId: peerId, name: peerName, image: peerImage, stream: null, micOn: true, camOn: true });
      return next;
    });

    return pc;
  }

  function closePeer(peerId: string) {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId); // evita glare fantasma se o peer voltar
    setPeers(prev => { const n = new Map(prev); n.delete(peerId); return n; });
  }

  // ── Acquire local stream ─────────────────────────────────────────────────
  // Usa refs de device para evitar closure estale
  const acquireStream = useCallback(async (audio: boolean, video: boolean) => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());

    if (!audio && !video) {
      localStreamRef.current = null;
      setLocalStream(null);
      pcsRef.current.forEach(pc => {
        pc.getSenders().forEach(s => { if (s.track) pc.removeTrack(s); });
      });
      return;
    }

    try {
      setCamError(null);

      // Pre-flight: se o ambiente não suporta, falhe com mensagem clara
      // (em vez de stack trace de TypeError com `mediaDevices undefined`).
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        throw new Error(
          "INSECURE_CONTEXT: este site precisa estar em HTTPS pra acessar câmera e microfone.",
        );
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        throw new Error(
          "MEDIA_API_UNAVAILABLE: este browser não suporta captura de mídia, ou a página está bloqueando o acesso (Permissions-Policy).",
        );
      }

      // Só usa `exact` se o device persistido está na enumeração atual; se
      // sumiu (headset desconectado), cai no default sem apagar a preferência.
      const storedPreferences = useMediaDeviceStore.getState();
      const currentDevices = getCurrentDevices();
      const preferredAudioInputId = resolvePreferredDeviceId(
        storedPreferences.audioInputId, currentDevices.audio,
      );
      const preferredVideoInputId = resolvePreferredDeviceId(
        storedPreferences.videoInputId, currentDevices.video,
      );
      const constraints: MediaStreamConstraints = {
        audio: audio
          ? (preferredAudioInputId ? { deviceId: { exact: preferredAudioInputId } } : true)
          : false,
        video: video
          ? (preferredVideoInputId ? { deviceId: { exact: preferredVideoInputId } } : { width: 640, height: 480, facingMode: "user" })
          : false,
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Corrida enumeração×unplug: device preferido saiu depois da última
        // enumeração — tenta uma vez com os defaults do sistema.
        const hadPreferredDevice = Boolean(preferredAudioInputId || preferredVideoInputId);
        if (!hadPreferredDevice || !isDeviceUnavailableError(err)) throw err;
        stream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: video ? { width: 640, height: 480, facingMode: "user" } : false,
        });
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      await refreshDevices();

      pcsRef.current.forEach(pc => {
        stream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track);
          else pc.addTrack(track, stream);
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[useWebRTC] getUserMedia:", msg);

      // Reverte estado
      if (video)  { camOnRef.current = false;  setCamOn(false);  }
      if (audio)  { micOnRef.current = false;   setMicOn(false);  }

      if (msg.includes("INSECURE_CONTEXT")) {
        setCamError("Este site precisa estar em HTTPS pra acessar câmera e microfone. Acesse pela URL https://...");
      } else if (msg.includes("MEDIA_API_UNAVAILABLE")) {
        setCamError("Browser não suporta captura de mídia ou a página está bloqueando (Permissions-Policy). Tente em outra aba (não embarcado em iframe) e em Chrome/Edge/Firefox/Safari atualizados.");
      } else if (msg.includes("by system")) {
        setCamError("Acesso negado pelo sistema. Vá em Preferências do Sistema → Privacidade → Microfone/Câmera e permita o navegador.");
      } else if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        setCamError("Permissão negada pelo navegador. Clique no cadeado na barra de endereços e permita o acesso.");
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
        setCamError("Nenhum dispositivo de microfone/câmera encontrado.");
      } else {
        setCamError(`Erro ao acessar mídia: ${msg}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDevices]);

  function broadcastMediaState(m: boolean, c: boolean) {
    rtcPost({ type: "media", micOn: m, camOn: c });
  }

  // ── Toggle mic ───────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    } else if (next) {
      await acquireStream(true, camOnRef.current);
    }
    broadcastMediaState(next, camOnRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquireStream]);

  // ── Toggle camera ────────────────────────────────────────────────────────
  const toggleCam = useCallback(async () => {
    const next = !camOnRef.current;
    camOnRef.current = next;
    setCamOn(next);

    if (!next) {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; t.stop(); });
      // Remove video sender dos peers
      pcsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender?.track) { sender.track.stop(); pc.removeTrack(sender); }
      });
      if (!micOnRef.current) {
        localStreamRef.current = null;
        setLocalStream(null);
      }
    } else {
      await acquireStream(micOnRef.current, true);
    }
    broadcastMediaState(micOnRef.current, next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquireStream]);

  // Track the exact senders added for screen share (per peer) so we can remove them cleanly
  const screenSendersRef = useRef<Map<string, RTCRtpSender[]>>(new Map());

  // ── Toggle screen share ──────────────────────────────────────────────────
  // Uses onnegotiationneeded (set in getOrCreatePC) — adding/removing tracks
  // triggers automatic renegotiation, no manual createOffer/setLocalDescription needed.
  const toggleScreen = useCallback(async () => {
    if (screenOnRef.current) {
      // ── Stop screen sharing ────────────────────────────────────────────
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      screenOnRef.current = false;
      setScreenOn(false);

      // Remove exactly the senders we added (don't touch camera senders)
      screenSendersRef.current.forEach((senders, peerId) => {
        const pc = pcsRef.current.get(peerId);
        if (!pc) return;
        senders.forEach(s => { try { pc.removeTrack(s); } catch {/* ok */} });
      });
      screenSendersRef.current.clear();

      // Tell peers we stopped (their ScreenShareOverlay will close)
      triggerScreenServer(false);
    } else {
      // ── Start screen sharing ───────────────────────────────────────────
      try {
        if (typeof window !== "undefined" && window.isSecureContext === false) {
          throw new Error(
            "INSECURE_CONTEXT: este site precisa estar em HTTPS pra compartilhar tela.",
          );
        }
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getDisplayMedia !== "function"
        ) {
          throw new Error(
            "DISPLAY_API_UNAVAILABLE: este browser não suporta compartilhamento de tela ou a página está bloqueando o acesso (Permissions-Policy: display-capture).",
          );
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        screenOnRef.current = true;
        setScreenOn(true);

        // Broadcast FIRST so peers set screenOn=true before the track arrives
        triggerScreenServer(true);

        // Give the signal time to propagate before the track arrives
        await new Promise(r => setTimeout(r, 400));

        // Add screen track to each peer — onnegotiationneeded handles the rest
        pcsRef.current.forEach((pc, peerId) => {
          const senders: RTCRtpSender[] = [];
          stream.getTracks().forEach(track => {
            try {
              const sender = pc.addTrack(track, stream);
              senders.push(sender);
            } catch {/* ok */}
          });
          screenSendersRef.current.set(peerId, senders);
        });

        // Auto-stop when user ends via the browser's native share UI
        stream.getVideoTracks()[0].onended = () => {
          if (screenOnRef.current) void toggleScreenRef.current?.();
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[useWebRTC] getDisplayMedia error:", msg);
        if (msg.includes("INSECURE_CONTEXT")) {
          setCamError("Este site precisa estar em HTTPS pra compartilhar tela.");
        } else if (msg.includes("DISPLAY_API_UNAVAILABLE")) {
          setCamError("Compartilhamento de tela bloqueado: browser sem suporte ou Permissions-Policy não libera display-capture.");
        } else if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
          setCamError("Você cancelou ou negou o compartilhamento de tela.");
        } else {
          setCamError(`Erro ao compartilhar tela: ${msg}`);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, userId]);

  // Ref so the stream.onended callback can call latest toggleScreen without stale closure
  const toggleScreenRef = useRef<typeof toggleScreen | null>(null);
  useEffect(() => { toggleScreenRef.current = toggleScreen; }, [toggleScreen]);

  // ── Toggle bubble lock ───────────────────────────────────────────────────
  const toggleBubbleLock = useCallback(() => {
    setBubbleLocked(prev => !prev);
  }, []);

  return {
    micOn, camOn, camError,
    localStream,
    peers,
    toggleMic, toggleCam,
    settingsOpen, setSettingsOpen,
    devices,
    selectedAudio: audioInputId,
    setSelectedAudio: setAudioInputId,
    selectedVideo: videoInputId,
    setSelectedVideo: setVideoInputId,
    selectedOutput: audioOutputId,
    setSelectedOutput: setAudioOutputId,
    applyDeviceChange: useCallback(async () => {
      await acquireStream(micOnRef.current, camOnRef.current);
    }, [acquireStream]),
    requestDevicePermissions,
    // Screen sharing
    screenOn, screenStream, screenStreamRef, toggleScreen,
    // Communication bubble
    bubblePeers, bubbleLocked, toggleBubbleLock,
    // Sinais de saúde — o mesh não tem autoplay-unlock nem reconexão LiveKit,
    // então retornamos valores estáticos só pra unificar a fachada com o SFU
    // (space-game lê os banners via `webrtc.*`, não via `sfu.*`).
    audioBlocked: false,
    connectionState: "connected" as const,
  };
}
