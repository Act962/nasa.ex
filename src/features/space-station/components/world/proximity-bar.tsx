"use client";

/**
 * ProximityBar — WorkAdventure-style top bar that appears when players are nearby.
 * Shows a tile for each person in the proximity bubble (avatar + name + mic status).
 */

import { useEffect, useRef } from "react";
import { Mic, MicOff, X } from "lucide-react";
import type { RemotePeer } from "../../hooks/use-webrtc";

interface TileProps {
  name:      string;
  nick?:     string | null;
  spriteUrl: string | null;
  micOn:     boolean;
  isLocal?:  boolean;
}

/** Draws idle-down frame from a Pipoya spritesheet on a small canvas */
function AvatarCanvas({ url }: { url: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !url) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const fw = img.naturalWidth <= 96 ? 32 : 64;
      ctx.clearRect(0, 0, 52, 52);
      // idle-down = row 0, col 1 → offset (fw, 0)
      ctx.drawImage(img, fw, 0, fw, fw, 0, 0, 52, 52);
    };
    img.src = url;
  }, [url]);

  return (
    <canvas
      ref={ref}
      width={52}
      height={52}
      style={{ imageRendering: "pixelated", width: 52, height: 52 }}
    />
  );
}

function BubbleTile({ name, nick, spriteUrl, micOn, isLocal }: TileProps) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Avatar tile */}
      <div className={`relative w-[72px] h-[72px] rounded-2xl overflow-hidden flex items-center justify-center
        ${isLocal
          ? "bg-slate-700/80 ring-2 ring-indigo-400/60"
          : "bg-slate-800/80 ring-1 ring-white/10"
        }`}
        style={{ backdropFilter: "blur(8px)" }}
      >
        {spriteUrl ? (
          <AvatarCanvas url={spriteUrl} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-xl font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Mic indicator (bottom-right badge) */}
        <div className={`absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg
          ${micOn ? "bg-emerald-500" : "bg-rose-500"}`}>
          {micOn
            ? <Mic className="h-2.5 w-2.5 text-white" />
            : <MicOff className="h-2.5 w-2.5 text-white" />
          }
        </div>
      </div>

      {/* Name + nick */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-semibold text-white/90 max-w-[72px] truncate text-center leading-tight">
          {isLocal ? "Você" : name}
        </span>
        {nick && (
          <span className="text-[9px] text-slate-400 max-w-[72px] truncate text-center leading-tight">
            @{nick}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  bubblePeers:     Set<string>;
  peers:           Map<string, RemotePeer>;
  localName:       string;
  localNick?:      string;
  localMicOn:      boolean;
  localSpriteUrl?: string | null;
  /** Opcional: no modo full-mesh (todos na sala se ouvem) não há "bolha" pra
   *  sair, então o botão de sair fica oculto quando não passado. */
  onLeave?:        () => void;
}

export function ProximityBar({ bubblePeers, peers, localName, localNick, localMicOn, localSpriteUrl, onLeave }: Props) {
  if (bubblePeers.size === 0) return null;

  const bubbleList = Array.from(bubblePeers)
    .map(id => peers.get(id))
    .filter((p): p is RemotePeer => Boolean(p));

  return (
    <div className="absolute top-[88px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none">
      <div
        className="flex items-end gap-2 px-4 py-3 rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
        style={{
          background: "linear-gradient(135deg, rgba(15,18,40,0.96) 0%, rgba(20,24,52,0.96) 100%)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Local tile */}
        <BubbleTile
          name={localName}
          nick={localNick}
          spriteUrl={localSpriteUrl ?? null}
          micOn={localMicOn}
          isLocal
        />

        {/* Separator */}
        <div className="w-px h-14 bg-white/10 mx-1" />

        {/* Remote tiles */}
        {bubbleList.map(peer => (
          <BubbleTile
            key={peer.userId}
            name={peer.name}
            nick={peer.nick}
            spriteUrl={peer.spriteUrl ?? null}
            micOn={peer.micOn}
          />
        ))}

        {/* Separator + leave — só no modo bolha (proximidade). No full-mesh,
            todos na sala se ouvem e o mute fica no microfone do MediaBar. */}
        {onLeave && (
          <>
            <div className="w-px h-14 bg-white/10 mx-1" />
            <div className="flex flex-col items-center gap-1 self-center">
              <button
                onClick={onLeave}
                title="Sair da bolha"
                className="w-8 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 text-rose-400 flex items-center justify-center transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="text-[9px] text-slate-500">Sair</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
