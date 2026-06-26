"use client";

/**
 * CommunicationBubble — WorkAdventure-style proximity chat bubble.
 * Appears at the bottom-center when other players are nearby.
 */

import { Lock, LockOpen, Users } from "lucide-react";
import type { RemotePeer } from "../../hooks/use-sfu-room";
import Image from "next/image";

interface Props {
  bubblePeers:     Set<string>;
  peers:           Map<string, RemotePeer>;
  bubbleLocked:    boolean;
  onToggleLock:    () => void;
}

export function CommunicationBubble({
  bubblePeers, peers, bubbleLocked, onToggleLock,
}: Props) {
  if (bubblePeers.size === 0) return null;

  const bubblePeerList = Array.from(bubblePeers)
    .map(id => peers.get(id))
    .filter((p): p is RemotePeer => Boolean(p));

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none">
      {/* Animated ring */}
      <div className="relative flex flex-col items-center gap-2">
        {/* Pulse rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-full border-2 border-indigo-400/20 animate-ping absolute" style={{ animationDuration: "2s" }} />
          <div className="w-24 h-24 rounded-full border-2 border-indigo-400/30 animate-ping absolute" style={{ animationDuration: "2.5s" }} />
        </div>

        {/* Bubble card */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 rounded-2xl px-4 py-3 shadow-xl shadow-indigo-900/30 min-w-[220px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-white">Bolha de conversa</span>
            <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">
              {bubblePeers.size + 1}
            </span>
          </div>

          {/* Peer avatars */}
          <div className="flex items-center gap-1.5 mb-3">
            {/* You */}
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs text-white font-bold border-2 border-indigo-400 flex-shrink-0"
              title="Você">
              Eu
            </div>
            {bubblePeerList.slice(0, 5).map(peer => (
              <div key={peer.userId} className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0" title={peer.name}>
                {peer.image ? (
                  <Image src={peer.image} alt={peer.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-600 flex items-center justify-center text-xs text-white font-bold">
                    {peer.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Online dot */}
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
              </div>
            ))}
            {bubblePeerList.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-white/20 flex items-center justify-center text-[10px] text-slate-300 font-bold">
                +{bubblePeerList.length - 5}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Lock */}
            <button
              onClick={onToggleLock}
              title={bubbleLocked ? "Desbloquear conversa" : "Bloquear conversa"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center ${
                bubbleLocked
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                  : "bg-white/8 text-slate-300 border border-white/10 hover:bg-white/15"
              }`}
            >
              {bubbleLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
              {bubbleLocked ? "Bloqueada" : "Bloquear"}
            </button>
          </div>

          {bubbleLocked && (
            <p className="text-[10px] text-amber-400/80 mt-2 text-center">
              🔒 Novos participantes bloqueados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
