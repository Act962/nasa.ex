"use client";

/**
 * ScreenShareOverlay — WorkAdventure-style screen share display.
 * Shows the active screen share prominently on the right side of the screen.
 * Visible to all participants in the proximity bubble.
 */

import { useEffect, useRef, useState } from "react";
import { Monitor, X, Maximize2, Minimize2 } from "lucide-react";
import type { RemotePeer } from "../../hooks/use-sfu-room";

interface Props {
  /** Local screen stream (when I'm sharing) */
  localScreenStream?: MediaStream | null;
  localScreenOn?:     boolean;
  localName:          string;
  /** Remote peers — we show the first one that has screenOn + screenStream */
  peers:              Map<string, RemotePeer>;
}

function ScreenVideo({ stream, mirrored = false }: { stream: MediaStream; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-contain"
      style={mirrored ? { transform: "scaleX(-1)" } : {}}
    />
  );
}

export function ScreenShareOverlay({ localScreenStream, localScreenOn, localName, peers }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Determine active screen share: local takes priority, then first remote peer sharing
  let activeStream: MediaStream | null = null;
  let activeName = "";

  if (localScreenOn && localScreenStream) {
    activeStream = localScreenStream;
    activeName = `${localName} (você)`;
  } else {
    for (const peer of peers.values()) {
      if (peer.screenOn && peer.screenStream) {
        activeStream = peer.screenStream;
        activeName = peer.name;
        break;
      }
    }
  }

  if (!activeStream) return null;

  if (expanded) {
    return (
      <div className="absolute inset-0 z-40 bg-black/95 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-indigo-400" />
            <span className="text-white text-sm font-semibold">Tela de {activeName}</span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Fullscreen video */}
        <div className="flex-1 bg-black">
          <ScreenVideo stream={activeStream} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute z-30 flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
      style={{
        right: 16,
        top: "50%",
        transform: "translateY(-50%)",
        width: 480,
        height: 270,
        background: "rgba(8,10,24,0.97)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <Monitor className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-white text-[11px] font-semibold truncate max-w-[260px]">
            {activeName} está compartilhando a tela
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(true)}
            title="Expandir"
            className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 bg-black relative overflow-hidden">
        <ScreenVideo stream={activeStream} />
      </div>
    </div>
  );
}
