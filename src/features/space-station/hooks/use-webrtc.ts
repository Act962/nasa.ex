"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { resolveRemoteSpriteUrl } from "../utils/sprite-defaults";

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

export function useWebRTC({ stationId, userId, userName, userImage }: UseWebRTCOptions) {
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
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({
    audio: [], video: [],
  });
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [selectedVideo, setSelectedVideo] = useState<string>("");

  // Screen sharing
  const [screenOn,     setScreenOn]     = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenOnRef     = useRef(false);

  // Communication bubble
  const [bubblePeers,  setBubblePeers]  = useState<Set<string>>(new Set());
  const [bubbleLocked, setBubbleLocked] = useState(false);
  const bubbleLockedRef = useRef(false);

  // Refs — sobrevivem re-renders sem disparar effects
  const localStreamRef  = useRef<MediaStream | null>(null);
  const pcsRef          = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef      = useRef<import("pusher-js").PresenceChannel | null>(null);
  const makingOfferRef  = useRef<Map<string, boolean>>(new Map());
  const micOnRef        = useRef(false);
  const camOnRef        = useRef(false);
  // Refs para device IDs — evita closures estale em toggleMic/toggleCam
  const selectedAudioRef = useRef("");
  const selectedVideoRef = useRef("");

  // Manter refs sincronizados com estado
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);
  useEffect(() => { camOnRef.current = camOn; }, [camOn]);
  useEffect(() => { selectedAudioRef.current = selectedAudio; }, [selectedAudio]);
  useEffect(() => { selectedVideoRef.current = selectedVideo; }, [selectedVideo]);
  useEffect(() => { bubbleLockedRef.current = bubbleLocked; }, [bubbleLocked]);
  useEffect(() => { screenOnRef.current = screenOn; }, [screenOn]);

  // ── Enumerate devices ────────────────────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audio: all.filter(d => d.kind === "audioinput"),
        video: all.filter(d => d.kind === "videoinput"),
      });
    } catch { /* permissão não concedida ainda */ }
  }, []);

  // ── Pusher presence channel ──────────────────────────────────────────────
  useEffect(() => {
    let ch: import("pusher-js").Channel | null = null;
    let pusherRtcInstance: import("pusher-js").default | null = null;

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

      const onProximityEnter = (e: Event) => {
        const { peerId, peerName, peerImage } = (e as CustomEvent).detail as {
          peerId: string; peerName: string; peerImage: string | null;
        };
        if (peerId === userId) return;
        // Don't admit new peers if bubble is locked
        if (bubbleLockedRef.current) return;
        setBubblePeers(prev => new Set([...prev, peerId]));
        // Tie-breaker: only the "smaller" userId initiates the offer → avoids glare.
        // The other side creates the PC and waits for the incoming offer.
        if (!pcsRef.current.has(peerId)) {
          if (userId < peerId) {
            createOffer(peerId, peerName, peerImage);
          } else {
            getOrCreatePC(peerId, peerName, peerImage, false);
          }
        }
        // If we're currently sharing, re-announce so the new peer knows
        if (screenOnRef.current) {
          setTimeout(() => triggerScreenServer(true), 300);
        }
      };

      const onProximityLeave = (e: Event) => {
        const { peerId } = (e as CustomEvent).detail as { peerId: string };
        setBubblePeers(prev => { const n = new Set(prev); n.delete(peerId); return n; });
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

      window.addEventListener("space-station:proximity-enter", onProximityEnter);
      window.addEventListener("space-station:proximity-leave", onProximityLeave);
      window.addEventListener("space-station:peer-sprite",     onPeerSprite);
    }

    setup();
    refreshDevices();

    return () => {
      ch?.unsubscribe();
      pusherRtcInstance?.disconnect();
      pusherRtcInstance = null;
      pcsRef.current.forEach(pc => pc.close());
      pcsRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, userId]);

  // ── RTCPeerConnection ────────────────────────────────────────────────────
  function getOrCreatePC(peerId: string, peerName: string, peerImage: string | null, _isInitiator: boolean): RTCPeerConnection {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId)!;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(peerId, pc);

    // Add existing local tracks (mic/cam) and screen tracks (if already sharing)
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    screenStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, screenStreamRef.current!));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) rtcPost({ type: "ice", to: peerId, candidate });
    };

    // Auto-renegotiation whenever tracks are added/removed
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(peerId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        rtcPost({ type: "offer", to: peerId, fromName: userName, fromImage: userImage ?? null, sdp: offer });
      } catch (err) {
        console.warn("[useWebRTC] onnegotiationneeded error:", err);
      } finally {
        makingOfferRef.current.set(peerId, false);
      }
    };

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

  async function createOffer(peerId: string, peerName: string, peerImage: string | null) {
    const pc = getOrCreatePC(peerId, peerName, peerImage, true);
    try {
      makingOfferRef.current.set(peerId, true);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      rtcPost({ type: "offer", to: peerId, fromName: userName, fromImage: userImage ?? null, sdp: offer });
    } finally {
      makingOfferRef.current.set(peerId, false);
    }
  }

  function closePeer(peerId: string) {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
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

      const constraints: MediaStreamConstraints = {
        audio: audio
          ? (selectedAudioRef.current ? { deviceId: { exact: selectedAudioRef.current } } : true)
          : false,
        video: video
          ? (selectedVideoRef.current ? { deviceId: { exact: selectedVideoRef.current } } : { width: 640, height: 480, facingMode: "user" })
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
    devices, selectedAudio, setSelectedAudio, selectedVideo, setSelectedVideo,
    applyDeviceChange: useCallback(async () => {
      await acquireStream(micOnRef.current, camOnRef.current);
    }, [acquireStream]),
    // Screen sharing
    screenOn, screenStream, screenStreamRef, toggleScreen,
    // Communication bubble
    bubblePeers, bubbleLocked, toggleBubbleLock,
  };
}
