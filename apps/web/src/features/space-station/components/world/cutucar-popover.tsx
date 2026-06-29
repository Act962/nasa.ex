"use client";

/**
 * CutucarPopover — popover ancorado ao avatar de um peer quando o user clica
 * direto nele no mapa. Versão simplificada da Bolha de conversa:
 *   - Sem peer-selector (peer já é o alvo do clique)
 *   - Sem toggle de "bloquear bolha"
 *   - Sem proximidade — funciona pra QUALQUER peer no mundo
 *
 * 8 ações: N-Box · Formulários · Agenda · Forge · Scripts · Arquivo · Imagem · Chat
 * Os 7 primeiros são stub (toast). Chat alterna pra modo inline com
 * `PeerMessageField` (textarea + emoji + send) sem abrir drawer.
 *
 * Posicionamento: `fixed` em coords screen-space vindas do CustomEvent
 * `space-station:peer-click`. Inverte vertical (sobe vs desce) baseado em
 * espaço disponível pra não cortar.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BUBBLE_APPS, type BubbleApp } from "../../lib/bubble-apps";
import { PeerMessageField } from "./peer-message-field";

interface Props {
  peerId: string;
  peerName: string;
  /** Coords screen-space (px) do clique, vindas do CustomEvent. */
  anchorX: number;
  anchorY: number;
  /** stationId pra disparar o broadcast `peer:poked`. */
  stationId: string;
  onClose: () => void;
}

const POPOVER_HEIGHT_APPS = 220;
const POPOVER_HEIGHT_CHAT = 360;
const POPOVER_WIDTH = 280;
const GAP_FROM_AVATAR = 24;

export function CutucarPopover({
  peerId,
  peerName,
  anchorX,
  anchorY,
  stationId,
  onClose,
}: Props) {
  const [view, setView] = useState<"apps" | "chat">("apps");
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside + Esc fecham.
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Pointerdown captura cliques antes do popover abrir (não dispara
    // imediatamente porque o evento que abriu já foi processado). Mesmo
    // assim deixamos um tick pra evitar fechar no próprio clique de abertura.
    const id = setTimeout(() => {
      document.addEventListener("pointerdown", onPointer);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Calcula posição: tenta colocar ACIMA do clique (`translate(-50%, -100%)`),
  // mas se não houver espaço (anchorY menor que a altura do popover + gap),
  // inverte pra ABAIXO. Mantém centralizado horizontalmente.
  const style = useMemo<React.CSSProperties>(() => {
    const height = view === "chat" ? POPOVER_HEIGHT_CHAT : POPOVER_HEIGHT_APPS;
    const flipDown = anchorY < height + GAP_FROM_AVATAR;
    // Clamp horizontal pra não vazar viewport.
    const halfWidth = POPOVER_WIDTH / 2;
    const minLeft = halfWidth + 8;
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 1920;
    const maxLeft = viewportWidth - halfWidth - 8;
    const clampedX = Math.max(minLeft, Math.min(maxLeft, anchorX));

    if (flipDown) {
      return {
        position: "fixed",
        left: clampedX,
        top: anchorY + GAP_FROM_AVATAR,
        transform: "translateX(-50%)",
        zIndex: 60,
      };
    }
    return {
      position: "fixed",
      left: clampedX,
      top: anchorY - GAP_FROM_AVATAR,
      transform: "translate(-50%, -100%)",
      zIndex: 60,
    };
  }, [anchorX, anchorY, view]);

  function handleStubApp(app: BubbleApp, label: string) {
    toast.info(`${label} → ${peerName} — em implementação`);
    // Mesmo sendo stub, dispara o "poke" visual: avisa o peer cutucado +
    // mostra 👋 acima do avatar dele pra todos. Quando os apps forem
    // implementados de verdade, o poke continua disparando junto.
    void fetch("/api/rpc/spaceStation/pokePeer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { stationId, toUserId: peerId, action: app },
      }),
    }).catch(() => {
      /* ignore — poke é best-effort */
    });
    onClose();
  }

  return (
    <div
      ref={rootRef}
      style={style}
      className="pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-150"
    >
      <div
        className={cn(
          "bg-slate-900/97 backdrop-blur-md border border-indigo-500/30",
          "rounded-2xl shadow-2xl shadow-indigo-900/40 overflow-hidden flex flex-col",
        )}
        style={{ width: POPOVER_WIDTH }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-indigo-300">
            Cutucar
          </span>
          <span className="text-sm font-medium text-white truncate">
            {peerName}
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* View: apps grid 4 cols */}
        {view === "apps" && (
          <div className="p-3">
            <div className="grid grid-cols-4 gap-1">
              {BUBBLE_APPS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => handleStubApp(a.id, a.label)}
                    title={a.label}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/8 transition-colors"
                  >
                    <Icon className={cn("h-4 w-4", a.color)} />
                    <span className="text-[9px] font-medium text-slate-200 truncate">
                      {a.label}
                    </span>
                  </button>
                );
              })}

              {/* Chat — não é stub, alterna pra view inline */}
              <button
                onClick={() => setView("chat")}
                title="Conversar"
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-violet-500/20 text-white transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-violet-300" />
                <span className="text-[9px] font-medium text-slate-200">
                  Chat
                </span>
              </button>
            </div>
          </div>
        )}

        {/* View: chat inline com PeerMessageField */}
        {view === "chat" && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 text-[10px] text-slate-400">
              <span>Mensagem direta via WhatsApp</span>
              <button
                onClick={() => setView("apps")}
                className="text-indigo-300 hover:text-indigo-200"
              >
                ← Voltar
              </button>
            </div>
            <PeerMessageField
              peerId={peerId}
              peerName={peerName}
              stationId={stationId}
              onSent={() => {
                toast.success(`Mensagem enviada pra ${peerName}`);
                onClose();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
