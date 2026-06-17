"use client";

/**
 * PokesPanel — painel fixo com a LISTA de cutucadas recebidas pelo user
 * atual. Botão pillzinho no canto inferior esquerdo (perto do Chat geral)
 * com badge de count. Clica → drawer com cards das cutucadas, cada uma
 * mostrando: quem cutucou, ação (chat/nbox/etc.), preview, hora, e botões
 * "Cutucar de volta" / "Dispensar".
 *
 * Diferente do toast (que some em 6s), as cutucadas ficam aqui ATÉ o user
 * dispensar manualmente OU responder. Sem persistência cross-session: ao
 * recarregar a página, a lista zera (efêmero por design — cutucada é
 * "presença social", não tarefa).
 */

import { useState } from "react";
import { Bell, X, MessageSquare, FolderOpen, ClipboardList, Calendar, Hammer, ScrollText, Paperclip, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReceivedPoke {
  id: string;
  fromUserId: string;
  fromName: string;
  action: string;
  preview: string | null;
  at: string; // ISO timestamp
}

interface Props {
  pokes: ReceivedPoke[];
  /** Dispensa uma cutucada específica (X no card). */
  onDismiss: (pokeId: string) => void;
  /** Limpa todas (botão no header). */
  onDismissAll: () => void;
  /** Abre Cutucar pro user que cutucou — fluxo "responder". */
  onPokeBack: (fromUserId: string, fromName: string) => void;
}

const ACTION_META: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  chat:    { label: "te mandou uma mensagem",        icon: MessageSquare,  color: "text-violet-300" },
  nbox:    { label: "compartilhou no N-Box",         icon: FolderOpen,     color: "text-blue-300"   },
  forms:   { label: "enviou um formulário",          icon: ClipboardList,  color: "text-indigo-300" },
  agenda:  { label: "te convidou pra um evento",     icon: Calendar,       color: "text-emerald-300"},
  forge:   { label: "compartilhou algo do Forge",    icon: Hammer,         color: "text-amber-300"  },
  scripts: { label: "compartilhou um script",        icon: ScrollText,     color: "text-fuchsia-300"},
  file:    { label: "te enviou um arquivo",          icon: Paperclip,      color: "text-slate-300"  },
  image:   { label: "te enviou uma imagem",          icon: ImageIcon,      color: "text-sky-300"    },
};

export function PokesPanel({ pokes, onDismiss, onDismissAll, onPokeBack }: Props) {
  const [open, setOpen] = useState(false);
  const count = pokes.length;

  return (
    <>
      {/* Botão pillzinho — perto do Chat geral pra não acumular UI. */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={count > 0 ? `${count} cutucada${count > 1 ? "s" : ""} pendente${count > 1 ? "s" : ""}` : "Sem cutucadas"}
        className={cn(
          "absolute bottom-20 left-32 z-30 pointer-events-auto",
          "flex items-center gap-2 px-3 py-2 rounded-full text-white text-xs font-semibold",
          "shadow-2xl border transition-all",
          count > 0
            ? "bg-rose-500/95 hover:bg-rose-400 border-rose-400/40 shadow-rose-900/40 animate-pulse"
            : "bg-slate-800/80 hover:bg-slate-700 border-white/10 shadow-slate-900/40",
        )}
      >
        <Bell className="h-3.5 w-3.5" />
        Cutucadas
        {count > 0 && (
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Drawer com a lista */}
      {open && (
        <>
          {/* Backdrop leve — clica fora pra fechar */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/20"
          />
          <aside className="fixed bottom-32 left-4 z-50 w-[360px] max-w-[95vw] bg-slate-950 border border-white/10 shadow-2xl rounded-2xl flex flex-col max-h-[60vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
              <Bell className="h-4 w-4 text-rose-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Cutucadas</p>
                <p className="text-[10px] text-slate-400">
                  {count === 0
                    ? "Nada por enquanto."
                    : `${count} pendente${count > 1 ? "s" : ""} · ficam aqui até você dispensar`}
                </p>
              </div>
              {count > 0 && (
                <button
                  onClick={onDismissAll}
                  className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                  title="Dispensar todas"
                >
                  Limpar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Lista de cutucadas */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {count === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">
                    Ninguém te cutucou ainda. Aproveita o silêncio. 😎
                  </p>
                </div>
              )}

              {pokes.map((p) => {
                const meta = ACTION_META[p.action] ?? ACTION_META.chat;
                const Icon = meta.icon;
                return (
                  <div
                    key={p.id}
                    className="bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl p-3 flex flex-col gap-2 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-2xl leading-none">👋</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {p.fromName}
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Icon className={cn("h-3 w-3", meta.color)} />
                          {meta.label}
                        </p>
                      </div>
                      <button
                        onClick={() => onDismiss(p.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0"
                        title="Dispensar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {p.preview && (
                      <div className="text-xs text-slate-200 bg-slate-900/60 rounded px-2 py-1.5 border border-white/5 line-clamp-3 italic">
                        &ldquo;{p.preview}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 flex-1">
                        {new Date(p.at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        onClick={() => {
                          onPokeBack(p.fromUserId, p.fromName);
                          onDismiss(p.id);
                          setOpen(false);
                        }}
                        className="text-[11px] font-medium text-indigo-300 hover:text-white px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/30 border border-indigo-400/30 transition-colors"
                      >
                        Cutucar de volta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
