"use client";

/**
 * ParticipantsPanel — Lista de participantes online na Space Station.
 *
 * Mostra um pill com os avatares empilhados no topo da tela.
 * Ao clicar, abre um painel listando todos os participantes (local + remotos)
 * com ações de mensagem e convite — estilo WorkAdventure.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, MessageSquare, UserPlus } from "lucide-react";

/* ─── Avatar canvas (idle-down frame do spritesheet Pipoya) ───────────────── */

function AvatarCanvas({ url, size = 56 }: { url: string | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    if (!url) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // idle-down = segunda coluna (col=1), primeira linha (row=0)
      const fw = img.naturalWidth <= 96 ? 32 : 64;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, fw, 0, fw, fw, 0, 0, size, size);
    };
    img.src = url;
  }, [url, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}

/* ─── Fallback inicial de avatar por nome ────────────────────────────────── */

function InitialAvatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="bg-indigo-700 flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ─── Tipos ──────────────────────────────────────────────────────────────── */

interface Participant {
  userId:    string;
  name:      string;
  nick?:     string | null;
  spriteUrl: string | null;
}

interface Props {
  localName:       string;
  localNick?:      string | null;
  localSpriteUrl?: string | null;
  onSendMessage:   (userId: string, name: string) => void;
  onInviteUser:    () => void;
}

/* ─── Componente principal ───────────────────────────────────────────────── */

export function ParticipantsPanel({
  localName,
  localNick,
  localSpriteUrl,
  onSendMessage,
  onInviteUser,
}: Props) {
  const [open, setOpen]                   = useState(false);
  const [participants, setParticipants]   = useState<Map<string, Participant>>(new Map());
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const panelRef                          = useRef<HTMLDivElement>(null);

  /* ── Ouve eventos de presença ─────────────────────────────────────────── */
  useEffect(() => {
    const onJoin = (e: Event) => {
      const { userId, name, nick, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name: string; nick?: string | null; spriteUrl?: string | null;
      };
      setParticipants(prev => {
        const next = new Map(prev);
        next.set(userId, {
          userId,
          name,
          nick:      nick      ?? null,
          spriteUrl: spriteUrl ?? null,
        });
        return next;
      });
    };

    const onLeave = (e: Event) => {
      const { userId } = (e as CustomEvent).detail as { userId: string };
      setParticipants(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      setSelectedId(prev => (prev === userId ? null : prev));
    };

    const onSprite = (e: Event) => {
      const { userId, name, nick, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name?: string; nick?: string | null; spriteUrl?: string | null;
      };
      setParticipants(prev => {
        if (!prev.has(userId)) return prev;
        const next     = new Map(prev);
        const existing = next.get(userId)!;
        next.set(userId, {
          ...existing,
          name:      name      ?? existing.name,
          nick:      nick      ?? existing.nick,
          spriteUrl: spriteUrl ?? existing.spriteUrl,
        });
        return next;
      });
    };

    window.addEventListener("space-station:remote-join",  onJoin);
    window.addEventListener("space-station:remote-leave", onLeave);
    window.addEventListener("space-station:peer-sprite",  onSprite);
    return () => {
      window.removeEventListener("space-station:remote-join",  onJoin);
      window.removeEventListener("space-station:remote-leave", onLeave);
      window.removeEventListener("space-station:peer-sprite",  onSprite);
    };
  }, []);

  /* ── Fecha ao clicar fora ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  /* ── Dados derivados ──────────────────────────────────────────────────── */
  const remoteList  = Array.from(participants.values());
  const totalCount  = 1 + remoteList.length; // +1 usuário local

  // Avatares do pill (local + até 2 remotos)
  type PillEntry = { spriteUrl: string | null; name: string };
  const pillAvatars: PillEntry[] = [
    { spriteUrl: localSpriteUrl ?? null, name: localName },
    ...remoteList.slice(0, 2).map(p => ({ spriteUrl: p.spriteUrl, name: p.name })),
  ];
  const extraCount = remoteList.length > 2 ? remoteList.length - 2 : 0;

  // Participante selecionado para ação
  const selectedParticipant = selectedId ? participants.get(selectedId) ?? null : null;

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div
      ref={panelRef}
      className="absolute top-[88px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none"
    >
      {/* ── Pill toggle ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 shadow-2xl shadow-black/50 transition-all hover:border-white/25 active:scale-95"
        style={{
          background:     "linear-gradient(135deg, rgba(15,18,40,0.96) 0%, rgba(20,24,52,0.96) 100%)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Avatares empilhados */}
        <div className="flex items-center">
          {pillAvatars.map((p, i) => (
            <div
              key={i}
              className="relative w-8 h-8 rounded-xl overflow-hidden bg-slate-800 border-2 border-slate-950 flex items-center justify-center flex-shrink-0"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: pillAvatars.length - i }}
            >
              {p.spriteUrl
                ? <AvatarCanvas url={p.spriteUrl} size={32} />
                : <InitialAvatar name={p.name} size={32} />
              }
            </div>
          ))}
          {extraCount > 0 && (
            <div
              className="relative w-8 h-8 rounded-xl bg-slate-700/80 border-2 border-slate-950 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ marginLeft: -8, zIndex: 0 }}
            >
              +{extraCount}
            </div>
          )}
        </div>

        {/* Contagem */}
        <span className="text-white text-xs font-semibold tabular-nums">
          {totalCount}
        </span>

        {/* Chevron */}
        {open
          ? <ChevronUp   className="h-3.5 w-3.5 text-slate-400" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        }
      </button>

      {/* ── Painel dropdown ── */}
      {open && (
        <div
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          style={{
            background:     "linear-gradient(135deg, rgba(15,18,40,0.98) 0%, rgba(20,24,52,0.98) 100%)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Lista de Participantes
            </p>
          </div>

          {/* Lista */}
          <div className="max-h-[320px] overflow-y-auto">
            {/* ── Usuário local ── */}
            <ParticipantRow
              spriteUrl={localSpriteUrl ?? null}
              name="Você"
              nick={localNick}
              isLocal
              selected={false}
              onClick={() => {}}
            />

            {/* ── Remotos ── */}
            {remoteList.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6 px-4">
                Nenhum outro participante no mundo
              </p>
            ) : (
              remoteList.map(p => (
                <ParticipantRow
                  key={p.userId}
                  spriteUrl={p.spriteUrl}
                  name={p.name}
                  nick={p.nick}
                  selected={selectedId === p.userId}
                  onClick={() => setSelectedId(prev => prev === p.userId ? null : p.userId)}
                />
              ))
            )}
          </div>

          {/* Ações */}
          <div className="border-t border-white/10">
            <button
              onClick={() => {
                if (selectedParticipant) {
                  onSendMessage(selectedParticipant.userId, selectedParticipant.name);
                  setOpen(false);
                } else if (remoteList.length === 1) {
                  onSendMessage(remoteList[0].userId, remoteList[0].name);
                  setOpen(false);
                }
              }}
              disabled={remoteList.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageSquare className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="text-white text-sm">
                Enviar mensagem
                {selectedParticipant && (
                  <span className="text-slate-400"> para {selectedParticipant.name}</span>
                )}
              </span>
            </button>

            <button
              onClick={() => { onInviteUser(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-t border-white/5"
            >
              <UserPlus className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="text-white text-sm">Convidar usuário</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Linha de participante ──────────────────────────────────────────────── */

function ParticipantRow({
  spriteUrl, name, nick, isLocal, selected, onClick,
}: {
  spriteUrl: string | null;
  name:      string;
  nick?:     string | null;
  isLocal?:  boolean;
  selected:  boolean;
  onClick:   () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
        selected
          ? "bg-indigo-500/15 border-l-2 border-indigo-400"
          : "hover:bg-white/5 border-l-2 border-transparent"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 ${
          isLocal
            ? "bg-slate-700 ring-2 ring-indigo-400/50"
            : "bg-slate-800 ring-1 ring-white/10"
        }`}
      >
        {spriteUrl
          ? <AvatarCanvas url={spriteUrl} size={56} />
          : <InitialAvatar name={name} size={56} />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-semibold truncate">{name}</p>
          {isLocal && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
              Você
            </span>
          )}
        </div>
        {nick && (
          <p className="text-slate-400 text-xs truncate">@{nick}</p>
        )}
        {/* Indicador "online" */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          <span className="text-[10px] text-slate-500">Online</span>
        </div>
      </div>
    </button>
  );
}
