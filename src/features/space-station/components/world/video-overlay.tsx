"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Mic, MicOff, VideoOff, PictureInPicture2,
  X, Minus, Plus, Grip, LayoutGrid, Rows, Columns, Video,
} from "lucide-react";
import Image from "next/image";
import type { RemotePeer } from "../../hooks/use-webrtc";

type Layout = "grid" | "strip-h" | "strip-v";

interface OverlayPrefs {
  x: number | null;      // null = default corner
  y: number | null;
  scale: number;         // 0.6 – 1.6
  layout: Layout;
  hidden: boolean;
}

const PREFS_KEY = "space-station:video-overlay";
const DEFAULT_PREFS: OverlayPrefs = { x: null, y: null, scale: 1, layout: "grid", hidden: false };

function loadPrefs(): OverlayPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return DEFAULT_PREFS; }
}

interface Props {
  localStream:       MediaStream | null;
  localScreenStream?: MediaStream | null;
  localMicOn:        boolean;
  localCamOn:        boolean;
  localScreenOn?:    boolean;
  localName:         string;
  localImage?:       string | null;
  peers:             Map<string, RemotePeer>;
  onPiPToggle?:      (active: boolean) => void;
  sinkId?:           string;
}

export function VideoOverlay({ localStream, localScreenStream, localMicOn, localCamOn, localScreenOn, localName, localImage, peers, onPiPToggle, sinkId }: Props) {
  const [prefs, setPrefs] = useState<OverlayPrefs>(DEFAULT_PREFS);
  useEffect(() => { setPrefs(loadPrefs()); }, []);
  const updatePrefs = useCallback((patch: Partial<OverlayPrefs>) => {
    setPrefs(p => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const hasAnyVideo = localCamOn || localScreenOn || peers.size > 0;

  // Dragging state
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: rect.left,  origY: rect.top,
    };
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, origX, origY } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const nextX = Math.max(0, Math.min(window.innerWidth  - 120, origX + dx));
    const nextY = Math.max(0, Math.min(window.innerHeight - 80,  origY + dy));
    updatePrefs({ x: nextX, y: nextY });
  };
  const onDragEnd = (e: React.PointerEvent) => {
    dragRef.current = null;
    setDragging(false);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  };

  if (!hasAnyVideo) return null;

  // Hidden state — show a tiny floating pill to restore
  if (prefs.hidden) {
    return (
      <button
        onClick={() => updatePrefs({ hidden: false })}
        className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xl border border-white/10"
        title="Mostrar vídeos"
      >
        <Video className="h-3.5 w-3.5 text-indigo-300" />
        {peers.size + (localCamOn || localScreenOn ? 1 : 0)} vídeos
      </button>
    );
  }

  const effectiveLocalStream = localScreenOn && localScreenStream ? localScreenStream : localStream;
  const effectiveLocalCamOn  = localCamOn || (localScreenOn ?? false);

  const tiles = [
    {
      key: "local", name: localName, image: localImage ?? null,
      stream: effectiveLocalCamOn ? effectiveLocalStream : null,
      micOn: localMicOn, camOn: effectiveLocalCamOn,
      isLocal: true, isScreen: (localScreenOn ?? false) && !localCamOn,
    },
    ...Array.from(peers.values()).map(p => ({
      key: p.userId, name: p.name, image: p.image, stream: p.stream,
      micOn: p.micOn, camOn: p.camOn, isLocal: false, isScreen: false,
    })),
  ];

  const baseW = prefs.layout === "strip-v" ? 160 : tiles.length === 1 ? 240 : 180;
  const tileW = Math.round(baseW * prefs.scale);

  const layoutCls =
    prefs.layout === "strip-h" ? "flex-row flex-nowrap overflow-x-auto" :
    prefs.layout === "strip-v" ? "flex-col" :
    "flex-wrap";

  // Positioning: custom coords or default bottom-right
  const positionStyle: React.CSSProperties = prefs.x != null && prefs.y != null
    ? { left: prefs.x, top: prefs.y }
    : { right: 20, bottom: 80 };

  return (
    <div
      ref={containerRef}
      className={`absolute z-20 ${dragging ? "cursor-grabbing" : ""}`}
      style={{ ...positionStyle, maxWidth: "80vw" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-md rounded-t-xl px-1.5 py-1 border border-white/10 border-b-0 shadow-xl"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
      >
        <Grip className="h-3 w-3 text-slate-500 mr-1" />
        <span className="text-[10px] text-slate-400 font-medium mr-auto select-none">Vídeos</span>

        <IconBtn title="Grade"        active={prefs.layout === "grid"}    onClick={() => updatePrefs({ layout: "grid" })}>
          <LayoutGrid className="h-3 w-3" />
        </IconBtn>
        <IconBtn title="Linha"        active={prefs.layout === "strip-h"} onClick={() => updatePrefs({ layout: "strip-h" })}>
          <Rows className="h-3 w-3" />
        </IconBtn>
        <IconBtn title="Coluna"       active={prefs.layout === "strip-v"} onClick={() => updatePrefs({ layout: "strip-v" })}>
          <Columns className="h-3 w-3" />
        </IconBtn>

        <div className="w-px h-3 bg-white/10 mx-1" />

        <IconBtn title="Diminuir" onClick={() => updatePrefs({ scale: Math.max(0.6, +(prefs.scale - 0.15).toFixed(2)) })}>
          <Minus className="h-3 w-3" />
        </IconBtn>
        <span className="text-[9px] text-slate-400 font-mono w-7 text-center select-none">
          {Math.round(prefs.scale * 100)}%
        </span>
        <IconBtn title="Aumentar" onClick={() => updatePrefs({ scale: Math.min(1.6, +(prefs.scale + 0.15).toFixed(2)) })}>
          <Plus className="h-3 w-3" />
        </IconBtn>

        <div className="w-px h-3 bg-white/10 mx-1" />

        <IconBtn title="Ocultar" onClick={() => updatePrefs({ hidden: true })}>
          <X className="h-3 w-3" />
        </IconBtn>
      </div>

      {/* Tiles */}
      <div
        className={`flex gap-2 p-2 bg-slate-900/60 backdrop-blur-sm rounded-b-xl border border-white/10 border-t-0 ${layoutCls}`}
        style={{ maxHeight: prefs.layout === "strip-v" ? "70vh" : undefined, overflowY: prefs.layout === "strip-v" ? "auto" : undefined }}
      >
        {tiles.map(({ key, isScreen, ...tile }) => (
          <VideoTile key={key} {...tile} width={tileW} onPiPToggle={onPiPToggle} isScreen={isScreen} sinkId={sinkId} />
        ))}
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick, active }: {
  children: React.ReactNode; title: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
        active ? "bg-indigo-500/30 text-indigo-200" : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

interface TileProps {
  name:        string;
  image:       string | null;
  stream:      MediaStream | null;
  micOn:       boolean;
  camOn:       boolean;
  isLocal:     boolean;
  isScreen?:   boolean;
  width:       number;
  onPiPToggle?: (active: boolean) => void;
  sinkId?:     string;
}

function VideoTile({ name, image, stream, micOn, camOn, isLocal, isScreen, width, onPiPToggle, sinkId }: TileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [pipActive, setPipActive] = useState(false);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (!el) return;
    if (stream && camOn) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream, camOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream && camOn) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    } else {
      el.srcObject = null;
    }
  }, [stream, camOn]);

  // BUG FIX: <audio> separado pra remote peers — toca o áudio independente
  // do <video> existir/renderizar. Antes o áudio só tocava se camOn=true
  // (porque o <video> embedded tocava o áudio junto). Resultado: peers com
  // mic mas sem câmera (cenário do 3º usuário) ficavam mudos.
  // O <video> agora fica MUTADO sempre — áudio único vem desse <audio>.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (stream && !isLocal) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {
          // Autoplay bloqueado (browser sem interação do user ainda).
          // Quando o user clicar em qualquer canto, autoplay libera.
        });
      }
    } else {
      el.srcObject = null;
    }
  }, [stream, isLocal]);

  // Aplica saída de áudio selecionada (setSinkId — Chrome/Edge only).
  // Firefox/Safari ignoram silenciosamente por falta de suporte.
  useEffect(() => {
    if (isLocal) return;
    const el = audioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el?.setSinkId || !sinkId) return;
    el.setSinkId(sinkId).catch(() => {});
  }, [sinkId, isLocal]);

  const handlePiP = useCallback(async () => {
    const el = videoRef.current;
    if (!el || !stream) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
        onPiPToggle?.(false);
      } else {
        await el.requestPictureInPicture();
        setPipActive(true);
        onPiPToggle?.(true);
        el.addEventListener("leavepictureinpicture", () => {
          setPipActive(false);
          onPiPToggle?.(false);
        }, { once: true });
      }
    } catch { /* browser doesn't support PiP */ }
  }, [stream, onPiPToggle]);

  const height = Math.round(width * 0.5625);

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-slate-800 border border-white/10 shadow-xl flex-shrink-0"
      style={{ width, height }}
    >
      {camOn && stream ? (
        <video
          ref={setVideoRef}
          // SEMPRE mutado — áudio remoto vem do <audio> separado abaixo.
          // Sem isso, áudio tocaria duas vezes (video + audio = echo).
          muted
          autoPlay playsInline
          className="w-full h-full object-cover"
          style={isLocal && !isScreen ? { transform: "scaleX(-1)" } : {}}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          {image ? (
            <div className="relative w-14 h-14 rounded-full overflow-hidden">
              <Image src={image} alt={name} fill className="object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigo-700 flex items-center justify-center text-2xl font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          {!camOn && (
            <div className="absolute bottom-6 flex items-center gap-1 bg-black/50 rounded px-2 py-0.5">
              <VideoOff className="h-3 w-3 text-slate-300" />
              <span className="text-[10px] text-slate-300">Sem vídeo</span>
            </div>
          )}
        </div>
      )}

      {/* Áudio remoto — invisível, toca quando há stream e o peer não é local.
          Garante que ouvimos o peer mesmo sem câmera ligada. */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      {isScreen && (
        <div className="absolute top-1.5 left-1.5 bg-indigo-600/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
          Tela
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span className="text-white text-[10px] font-semibold truncate max-w-[60%]">
          {isLocal ? `${name} (você)` : name}
        </span>
        <div className="flex items-center gap-1">
          {(camOn && stream) && (
            <button
              onClick={handlePiP}
              title="Picture in Picture"
              className={`p-0.5 rounded transition-colors ${pipActive ? "text-emerald-400" : "text-slate-300 hover:text-white"}`}
            >
              <PictureInPicture2 className="h-3 w-3" />
            </button>
          )}
          <span className={`flex-shrink-0 ${micOn ? "text-emerald-400" : "text-rose-400"}`}>
            {micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          </span>
        </div>
      </div>

      {!isLocal && !stream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
