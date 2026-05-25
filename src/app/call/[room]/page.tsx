"use client";

/**
 * Página pública de chamada áudio/vídeo (LiveKit) — acessível por:
 *  - Consultor (do /tracking-chat): abre via window.open após
 *    `livekit.createLeadMeeting` retornar token.
 *  - Lead: clica no link enviado por WhatsApp.
 *
 * URL: `/call/[room]?t=<token>&n=<nome>&mode=video|audio`
 *
 * Não precisa de auth porque o token JWT já carrega identidade +
 * permissões (mint pelo backend em `createLeadMeeting`).
 *
 * UI minimal usando `livekit-client` direto (NÃO `@livekit/components-react`
 * — manter bundle limpo e reusar helpers do `src/lib/livekit/client.ts`).
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneOffIcon,
  AlertCircleIcon,
} from "lucide-react";
import {
  connectRoom,
  type Room,
  type RemoteParticipant,
} from "@/lib/livekit/client";

type CallMode = "video" | "audio";
type ConnState = "connecting" | "connected" | "disconnected" | "error";

export default function CallPage() {
  const router = useRouter();
  const params = useParams<{ room: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");
  const name = searchParams.get("n") ?? "Convidado";
  const mode = (searchParams.get("mode") as CallMode) ?? "video";

  const [connState, setConnState] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(mode === "audio");
  const [remotes, setRemotes] = useState<RemoteParticipantInfo[]>([]);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!token) {
      setError("Token de acesso ausente na URL.");
      setConnState("error");
      return;
    }

    let cancelled = false;
    let activeRoom: Room | null = null;

    async function connectAndPublish() {
      try {
        // ── 1. Pede permissão de mic/cam conforme o modo ──
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        });

        // ── 2. Mostra preview local imediatamente ──
        if (localVideoRef.current && mode === "video") {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          await localVideoRef.current.play().catch(() => {});
        }

        // ── 3. Conecta na room ──
        const room = await connectRoom({
          token: token!,
          roomOptions: {
            adaptiveStream: true,
            dynacast: true,
          },
        });
        if (cancelled) {
          room.disconnect();
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeRoom = room;
        roomRef.current = room;

        // ── 4. Publica tracks locais ──
        for (const track of stream.getTracks()) {
          if (track.kind === "audio") {
            await room.localParticipant.publishTrack(track, {
              source: "microphone" as never,
            });
          } else if (track.kind === "video" && mode === "video") {
            await room.localParticipant.publishTrack(track, {
              source: "camera" as never,
            });
          }
        }

        // ── 5. Setup handlers de participantes remotos ──
        const refreshRemotes = () => {
          const list: RemoteParticipantInfo[] = [];
          room.remoteParticipants.forEach((p) => {
            list.push({
              identity: p.identity,
              name: p.name ?? "Participante",
              participant: p,
            });
          });
          setRemotes(list);
        };

        room.on("participantConnected", refreshRemotes);
        room.on("participantDisconnected", refreshRemotes);
        room.on("trackSubscribed", refreshRemotes);
        room.on("trackUnsubscribed", refreshRemotes);
        refreshRemotes();

        setConnState("connected");
      } catch (err: any) {
        console.error("[call/room] failed to connect", err);
        const msg =
          err?.message ?? "Erro ao conectar na chamada. Tente novamente.";
        setError(msg);
        setConnState("error");
      }
    }

    connectAndPublish();

    return () => {
      cancelled = true;
      if (activeRoom) {
        activeRoom.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mode]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setMicMuted(enabled);
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || mode === "audio") return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    setCamOff(enabled);
  };

  const leaveCall = () => {
    roomRef.current?.disconnect();
    setConnState("disconnected");
    // Volta pra origem (chat ou tela de "obrigado")
    setTimeout(() => {
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    }, 300);
  };

  if (connState === "error") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircleIcon className="size-12 mx-auto text-red-400" />
          <h1 className="text-xl font-semibold">Não foi possível conectar</h1>
          <p className="text-sm text-white/70">{error}</p>
          <Button onClick={() => router.push("/")} variant="secondary">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (connState === "disconnected") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <PhoneOffIcon className="size-10 mx-auto text-white/60" />
          <p className="text-sm">Chamada encerrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header da chamada */}
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50">
            {connState === "connecting" ? "Conectando..." : "Em chamada"}
          </p>
          <p className="text-sm font-medium">{decodeURIComponent(name)}</p>
        </div>
        <p className="text-[10px] text-white/30 font-mono">
          {params.room?.toString().slice(0, 24)}...
        </p>
      </header>

      {/* Video grid: local + remotos */}
      <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 min-h-0">
        {/* Local */}
        <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center">
          {mode === "video" && !camOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-white/40 text-center text-xs">
              {mode === "audio" ? "🎙️ Áudio" : "Câmera desligada"}
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded">
            Você
          </span>
        </div>

        {/* Remotos */}
        {connState === "connected" && remotes.length === 0 && (
          <div className="rounded-xl bg-zinc-900 aspect-video flex items-center justify-center">
            <div className="text-center space-y-2">
              <Spinner className="size-5 mx-auto text-white/40" />
              <p className="text-xs text-white/40">
                Aguardando o outro lado entrar...
              </p>
            </div>
          </div>
        )}
        {remotes.map((r) => (
          <RemoteTile key={r.identity} participant={r.participant} name={r.name} mode={mode} />
        ))}
      </main>

      {/* Controls */}
      <footer className="px-4 py-4 border-t border-white/10 flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMic}
          className="rounded-full size-12 bg-white/10 hover:bg-white/20"
          aria-label={micMuted ? "Ativar microfone" : "Mutar microfone"}
        >
          {micMuted ? (
            <MicOffIcon className="size-5" />
          ) : (
            <MicIcon className="size-5" />
          )}
        </Button>
        {mode === "video" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCam}
            className="rounded-full size-12 bg-white/10 hover:bg-white/20"
            aria-label={camOff ? "Ligar câmera" : "Desligar câmera"}
          >
            {camOff ? (
              <VideoOffIcon className="size-5" />
            ) : (
              <VideoIcon className="size-5" />
            )}
          </Button>
        )}
        <Button
          variant="destructive"
          size="icon"
          onClick={leaveCall}
          className="rounded-full size-12 bg-red-500 hover:bg-red-600"
          aria-label="Encerrar chamada"
        >
          <PhoneOffIcon className="size-5" />
        </Button>
      </footer>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RemoteParticipantInfo {
  identity: string;
  name: string;
  participant: RemoteParticipant;
}

/**
 * Tile pra um participante remoto. Attach tracks de vídeo/áudio em
 * elementos HTML dedicados. Re-attach quando subscriptions mudam.
 */
function RemoteTile({
  participant,
  name,
  mode,
}: {
  participant: RemoteParticipant;
  name: string;
  mode: CallMode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const refresh = () => {
      let videoTrack = null;
      let audioTrack = null;
      participant.trackPublications.forEach((pub) => {
        if (pub.kind === "video" && pub.track) videoTrack = pub.track;
        if (pub.kind === "audio" && pub.track) audioTrack = pub.track;
      });
      if (videoTrack && videoRef.current) {
        (videoTrack as any).attach(videoRef.current);
        setHasVideo(true);
      } else {
        setHasVideo(false);
      }
      if (audioTrack && audioRef.current) {
        (audioTrack as any).attach(audioRef.current);
      }
    };

    refresh();
    participant.on("trackSubscribed", refresh);
    participant.on("trackUnsubscribed", refresh);
    return () => {
      participant.off("trackSubscribed", refresh);
      participant.off("trackUnsubscribed", refresh);
    };
  }, [participant]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center">
      {hasVideo && mode === "video" ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-white/40 text-center">
          <div className="size-16 rounded-full bg-white/10 mx-auto mb-2 flex items-center justify-center text-2xl font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs">{name}</p>
        </div>
      )}
      <audio ref={audioRef} autoPlay />
      <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded">
        {name}
      </span>
    </div>
  );
}
