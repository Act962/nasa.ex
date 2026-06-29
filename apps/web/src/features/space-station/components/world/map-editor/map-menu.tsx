"use client";

/**
 * MapMenu — Dropdown no topo (estilo WorkAdventure).
 * Aberto a partir do botão "Mapa" do MediaBar.
 */

import { useEffect, useRef } from "react";
import { Pencil, DoorOpen, MessageSquareText, PanelsTopLeft } from "lucide-react";

interface Props {
  onClose:          () => void;
  onOpenEditor:     () => void;
  onExploreRoom?:   () => void;
  onGlobalMessage?: () => void;
  onBackOffice?:    () => void;
  canEdit:          boolean;
}

export function MapMenu({
  onClose, onOpenEditor,
  onExploreRoom, onGlobalMessage, onBackOffice,
  canEdit,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // slight delay to avoid the same click from the Map button closing it immediately
    const t = setTimeout(() => {
      window.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onEsc);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const items = [
    {
      key:   "edit",
      icon:  <Pencil className="h-4 w-4" />,
      label: "Editor de mapa",
      desc:  "Adicionar objetos ao cenário",
      onClick: onOpenEditor,
      disabled: !canEdit,
      tip:  !canEdit ? "Apenas o proprietário pode editar" : undefined,
    },
    {
      key:   "explore",
      icon:  <DoorOpen className="h-4 w-4" />,
      label: "Explorar a sala",
      desc:  "Visão aérea do espaço",
      onClick: onExploreRoom,
    },
    {
      key:   "broadcast",
      icon:  <MessageSquareText className="h-4 w-4" />,
      label: "Enviar mensagem global",
      desc:  "Falar com todos no mapa",
      onClick: onGlobalMessage,
    },
    {
      key:   "back-office",
      icon:  <PanelsTopLeft className="h-4 w-4" />,
      label: "Back office",
      desc:  "Painel de administração",
      onClick: onBackOffice,
      disabled: !canEdit,
      tip:  !canEdit ? "Apenas o proprietário tem acesso" : undefined,
    },
  ];

  return (
    <div
      ref={ref}
      className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[280px] bg-slate-900/98 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-1.5 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* seta de conexão com o botão */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/98 border-t border-l border-white/10 rotate-45" />

      <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        Mapa
      </div>

      <div className="flex flex-col">
        {items.map((it) => (
          <button
            key={it.key}
            onClick={() => { if (it.onClick && !it.disabled) { it.onClick(); onClose(); } }}
            disabled={it.disabled}
            title={it.tip}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors w-full ${
              it.disabled
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5 active:bg-white/10"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 flex items-center justify-center flex-shrink-0">
              {it.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white font-medium leading-tight">{it.label}</div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{it.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
