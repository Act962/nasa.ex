"use client";

/**
 * BubbleAppsPanel — painel de integrações NASA que aparece quando há peers na bolha.
 *
 * Botões (1:1 com o peer selecionado):
 *   N-Box · Formulários · Agenda · Forge · Scripts · Arquivo · Imagem · Chat
 *
 * Status de instância:
 *   - Se EU não tenho WhatsAppInstance CONNECTED → banner "Conecte seu WhatsApp"
 *   - Se o PEER selecionado não tem instância → label "Peer ainda não conectou"
 *     + todos os botões de envio ficam disabled.
 */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Lock, LockOpen, Users, MessageSquare, AlertTriangle, QrCode,
  PanelLeft, PanelBottom, Move, X,
} from "lucide-react";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import type { RemotePeer } from "../../hooks/use-sfu-room";
import { BUBBLE_APPS, type BubbleApp } from "../../lib/bubble-apps";

export type { BubbleApp };

/**
 * Modo de docking da Bolha de conversa — persiste em localStorage.
 * - `floating`: card de 300px no canto inferior direito (padrão histórico)
 * - `left`:     sidebar de 300px colada na esquerda, full height
 * - `bottom`:   barra horizontal full width na parte de baixo
 * - `hidden`:   escondida; aparece pequeno botão "💬 Bolha" pra reabrir
 */
type BubbleDock = "floating" | "left" | "bottom" | "hidden";
const DOCK_STORAGE_KEY = "ss:bubble:dock";

function readDock(): BubbleDock {
  if (typeof window === "undefined") return "floating";
  const saved = localStorage.getItem(DOCK_STORAGE_KEY);
  if (saved === "left" || saved === "bottom" || saved === "hidden" || saved === "floating") {
    return saved;
  }
  return "floating";
}

interface Props {
  bubblePeers:  Set<string>;
  peers:        Map<string, RemotePeer>;
  bubbleLocked: boolean;
  onToggleLock: () => void;
  /** Abre QR de conexão da MINHA instância (configurações → whatsapp). */
  onConnectMyInstance: () => void;
  /** Abre chat lateral 1:1 com o peer selecionado. */
  onOpenChat: (peerUserId: string) => void;
  /** Callback opcional por app. */
  onOpenApp?: (app: BubbleApp, peerUserId: string) => void;
}

// Lista de apps extraída pra `../../lib/bubble-apps.ts` pra compartilhar com
// o popover do Cutucar (mesmo conjunto de ícones e labels).
const APPS = BUBBLE_APPS;

export function BubbleAppsPanel({
  bubblePeers, peers, bubbleLocked, onToggleLock,
  onConnectMyInstance, onOpenChat, onOpenApp,
}: Props) {
  const peerList = useMemo(() =>
    Array.from(bubblePeers)
      .map((id) => peers.get(id))
      .filter((p): p is RemotePeer => Boolean(p)),
    [bubblePeers, peers],
  );

  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const effectiveSelectedId = selectedPeerId && bubblePeers.has(selectedPeerId)
    ? selectedPeerId
    : peerList[0]?.userId ?? null;

  // Modo de docking persistido. Lê do localStorage no mount pra evitar
  // hydration mismatch (SSR sempre devolve "floating", client troca depois).
  const [dock, setDockState] = useState<BubbleDock>("floating");
  useEffect(() => { setDockState(readDock()); }, []);
  const setDock = (d: BubbleDock) => {
    setDockState(d);
    try { localStorage.setItem(DOCK_STORAGE_KEY, d); } catch { /* ignore */ }
  };

  const { data: status } = useQuery({
    ...orpc.spaceStation.getBubblePeersStatus.queryOptions({
      input: { peerUserIds: peerList.map((p) => p.userId) },
    }),
    enabled: peerList.length > 0,
    refetchInterval: 15000,
  });

  if (bubblePeers.size === 0) return null;

  const meHasInstance     = !!status?.me?.hasInstance;
  const selectedPeerStatus = status?.peers.find((p) => p.userId === effectiveSelectedId);
  const peerHasInstance   = !!selectedPeerStatus?.hasInstance;
  const canSend           = meHasInstance && peerHasInstance;

  const handleApp = (app: BubbleApp) => {
    if (!effectiveSelectedId) return;
    if (!canSend) return;
    onOpenApp?.(app, effectiveSelectedId);
  };

  const handleChat = () => {
    if (!effectiveSelectedId) return;
    onOpenChat(effectiveSelectedId);
  };

  // ── Modo hidden: card recolhido vira só um botão flutuante. ────────────
  if (dock === "hidden") {
    return (
      <div className="absolute bottom-20 right-4 z-30 pointer-events-auto select-none">
        <button
          onClick={() => setDock("floating")}
          title="Abrir bolha de conversa"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold shadow-2xl shadow-indigo-900/40 border border-indigo-400/30 transition-all"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Bolha
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
            {bubblePeers.size + 1}
          </span>
        </button>
      </div>
    );
  }

  // ── Posicionamento + dimensões por modo. ──────────────────────────────
  // Containers ficam fixos relativos ao viewport; o card interno controla
  // a forma (largura/altura/borda) pra que esquerda/baixo virem barras
  // coladas na borda e o flutuante mantenha o card de 300px.
  const wrapperClass = cn(
    "absolute z-30 pointer-events-auto select-none",
    dock === "floating" && "bottom-20 right-4",
    dock === "left"     && "top-4 left-4 bottom-4",
    dock === "bottom"   && "left-1/2 -translate-x-1/2 bottom-2 w-full max-w-3xl px-2",
  );
  const cardClass = cn(
    "bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 shadow-2xl shadow-indigo-900/30 overflow-hidden flex flex-col",
    dock === "floating" && "rounded-2xl w-[300px]",
    dock === "left"     && "rounded-2xl w-[300px] h-full",
    dock === "bottom"   && "rounded-2xl w-full",
  );

  return (
    <div className={wrapperClass}>
      <div className={cardClass}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Users className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-white">Bolha de conversa</span>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-bold">
            {bubblePeers.size + 1}
          </span>

          {/* Dock controls — esquerda / baixo / flutuante / fechar */}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => setDock("left")}
              title="Encaixar à esquerda"
              className={cn(
                "p-1 rounded transition-colors",
                dock === "left"
                  ? "bg-indigo-500/30 text-indigo-200"
                  : "text-slate-400 hover:text-white hover:bg-white/10",
              )}
            >
              <PanelLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDock("bottom")}
              title="Encaixar embaixo"
              className={cn(
                "p-1 rounded transition-colors",
                dock === "bottom"
                  ? "bg-indigo-500/30 text-indigo-200"
                  : "text-slate-400 hover:text-white hover:bg-white/10",
              )}
            >
              <PanelBottom className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDock("floating")}
              title="Flutuante"
              className={cn(
                "p-1 rounded transition-colors",
                dock === "floating"
                  ? "bg-indigo-500/30 text-indigo-200"
                  : "text-slate-400 hover:text-white hover:bg-white/10",
              )}
            >
              <Move className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDock("hidden")}
              title="Fechar"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-rose-500/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Peer selector */}
        <div className="px-3 pt-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Me chip */}
            <div className="flex items-center gap-1.5 bg-indigo-600/80 text-white text-[11px] font-semibold rounded-full px-2 py-1">
              <span className="w-4 h-4 rounded-full bg-indigo-900/40 flex items-center justify-center text-[9px]">Eu</span>
              <span className={cn("w-1.5 h-1.5 rounded-full", meHasInstance ? "bg-emerald-400" : "bg-rose-400")} />
            </div>

            {peerList.map((peer) => {
              const pStat = status?.peers.find((s) => s.userId === peer.userId);
              const ok = !!pStat?.hasInstance;
              const active = peer.userId === effectiveSelectedId;
              return (
                <button
                  key={peer.userId}
                  onClick={() => setSelectedPeerId(peer.userId)}
                  title={peer.name}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-1.5 py-1 transition-colors",
                    active
                      ? "bg-violet-600/80 text-white"
                      : "bg-white/5 text-slate-300 hover:bg-white/10",
                  )}
                >
                  <span className="relative w-4 h-4 rounded-full overflow-hidden bg-slate-700 flex-shrink-0">
                    {peer.image ? (
                      <Image src={peer.image} alt={peer.name} fill className="object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-[8px] font-bold">
                        {peer.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="max-w-[70px] truncate">{peer.name}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-rose-400")} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Status banners */}
        {!meHasInstance && (
          <button
            onClick={onConnectMyInstance}
            className="w-full mt-3 mx-0 px-3 py-2 flex items-start gap-2 bg-amber-500/10 border-y border-amber-500/30 hover:bg-amber-500/20 text-left transition-colors"
          >
            <QrCode className="h-4 w-4 text-amber-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-200">Conecte seu WhatsApp</p>
              <p className="text-[10px] text-amber-300/80 leading-tight">Necessário para enviar mensagens na bolha.</p>
            </div>
          </button>
        )}

        {meHasInstance && !peerHasInstance && effectiveSelectedId && (
          <div className="mt-3 mx-3 px-2.5 py-2 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-300 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-200 leading-tight">
              {peerList.find((p) => p.userId === effectiveSelectedId)?.name ?? "Peer"} ainda não conectou o WhatsApp — não pode receber.
            </p>
          </div>
        )}

        {/* App grid */}
        <div className="grid grid-cols-4 gap-1 p-3">
          {APPS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => handleApp(a.id)}
                disabled={!canSend}
                title={canSend ? a.label : "Instância necessária"}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                  canSend
                    ? "hover:bg-white/10 text-white cursor-pointer"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                <Icon className={cn("h-4 w-4", a.color)} />
                <span className="text-[9px] font-medium text-slate-200">{a.label}</span>
              </button>
            );
          })}

          {/* Chat sempre habilitado (mesmo sem instância, UI mostra aviso lá dentro) */}
          <button
            onClick={handleChat}
            title="Abrir chat"
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-violet-500/20 text-white transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-violet-300" />
            <span className="text-[9px] font-medium text-slate-200">Chat</span>
          </button>
        </div>

        {/* Lock */}
        <div className="px-3 pb-3">
          <button
            onClick={onToggleLock}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
              bubbleLocked
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                : "bg-white/8 text-slate-300 border border-white/10 hover:bg-white/15",
            )}
          >
            {bubbleLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            {bubbleLocked ? "Bolha bloqueada" : "Bloquear bolha"}
          </button>
        </div>
      </div>
    </div>
  );
}
