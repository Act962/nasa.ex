"use client";

import {
  Mic, MicOff, Video, VideoOff, Share2,
  Map, Users, Smile, Settings, Monitor, MonitorOff, UserRound, MapPin,
  Check, ChevronDown, UserPlus,
} from "lucide-react";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import type { RemotePeer } from "../../hooks/use-webrtc";

/* ─── Avatar canvas — idle-down frame Pipoya (32×32 ou 64×64) ─────────────── */

function AvatarCanvas({ url, size }: { url: string | null; size: number }) {
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
      const fw = img.naturalWidth <= 96 ? 32 : 64;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, fw, 0, fw, fw, 0, 0, size, size);
    };
    img.src = url;
  }, [url, size]);
  return (
    <canvas
      ref={ref} width={size} height={size}
      style={{ imageRendering: "pixelated", width: size, height: size, display: "block" }}
    />
  );
}

function InitialAvatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="bg-indigo-700 flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export type UserStatus = "online" | "busy" | "brb" | "dnd";

export const STATUS_META: Record<UserStatus, { label: string; dot: string; text: string; description: string }> = {
  online: { label: "Online",            dot: "bg-emerald-400", text: "text-emerald-400", description: "Disponível" },
  busy:   { label: "Ocupado",           dot: "bg-amber-400",   text: "text-amber-400",   description: "Em reunião" },
  brb:    { label: "Volto em instantes",dot: "bg-sky-400",     text: "text-sky-400",     description: "Ausente brevemente" },
  dnd:    { label: "Não perturbe",      dot: "bg-rose-500",    text: "text-rose-400",    description: "Notificações silenciadas" },
};

const STATUS_STORAGE_KEY = "space-station:user-status";

interface Props {
  nick:              string;
  userName:          string;
  userImage?:        string | null;
  localSpriteUrl?:   string | null;
  micOn:             boolean;
  camOn:             boolean;
  screenOn?:         boolean;
  onToggleMic:       () => void;
  onToggleCam:       () => void;
  onToggleScreen?:   () => void;
  onOpenSettings:    () => void;
  onOpenShare:       () => void;
  onOpenConnect?:    () => void;
  connectPanelOpen?: boolean;
  onOpenMap?:        () => void;
  onOpenEmpresas?:   () => void;
  onOpenAvatar?:     () => void;
  mapActive?:        boolean;
  peers:             Map<string, RemotePeer>;
  isOwner?:          boolean;
}

export function MediaBar({
  nick, userName, userImage, localSpriteUrl,
  micOn, camOn, screenOn = false,
  onToggleMic, onToggleCam, onToggleScreen,
  onOpenSettings, onOpenShare,
  onOpenConnect, connectPanelOpen = false,
  onOpenMap, onOpenEmpresas, onOpenAvatar, mapActive = false,
  peers, isOwner,
}: Props) {
  void peers; // peers mantido na prop para compatibilidade — não mais exibido no pill
  const [status, setStatus] = useState<UserStatus>(() => {
    if (typeof window === "undefined") return "online";
    const saved = localStorage.getItem(STATUS_STORAGE_KEY) as UserStatus | null;
    return (saved && saved in STATUS_META) ? saved : "online";
  });
  const [statusOpen, setStatusOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STATUS_STORAGE_KEY, status);
  }, [status]);

  useEffect(() => {
    if (!statusOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setStatusOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [statusOpen]);

  const meta = STATUS_META[status];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-none select-none">
      {/* ── Left group: emoji + grid ── */}
      <div className="flex items-center gap-1 h-[52px] bg-black/50 backdrop-blur-sm rounded-2xl px-2 pointer-events-auto">
        {onOpenEmpresas && (
          <button
            onClick={onOpenEmpresas}
            title="Empresas"
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-violet-300 hover:text-white hover:bg-violet-500/20 transition-all text-xs font-semibold"
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden md:inline">Empresas</span>
          </button>
        )}
        {onOpenConnect && (
          <IconBtn
            title="Conectar pessoas"
            onClick={onOpenConnect}
            active={connectPanelOpen}
          >
            <UserPlus className="h-4 w-4" />
          </IconBtn>
        )}
        <IconBtn title="Reações" onClick={() => {}}>
          <Smile className="h-4 w-4" />
        </IconBtn>
        <WorldAvatarPill
          localSpriteUrl={localSpriteUrl ?? null}
          localName={userName}
          open={connectPanelOpen}
          onClick={onOpenConnect}
        />
      </div>

      {/* ── Center group: mic + cam ── */}
      <div className="flex items-center gap-1.5 h-[52px] bg-black/50 backdrop-blur-sm rounded-2xl px-3 pointer-events-auto">
        {/* Mic toggle */}
        <button
          onClick={onToggleMic}
          title={micOn ? "Desativar microfone" : "Ativar microfone"}
          className={`
            relative w-10 h-10 rounded-xl flex items-center justify-center transition-all
            ${micOn
              ? "bg-slate-700 hover:bg-slate-600 text-white"
              : "bg-rose-500 hover:bg-rose-400 text-white"}
          `}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {!micOn && (
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-rose-400 whitespace-nowrap font-medium">
              Mudo
            </span>
          )}
        </button>

        {/* Cam toggle */}
        <button
          onClick={onToggleCam}
          title={camOn ? "Desativar câmera" : "Ativar câmera"}
          className={`
            relative w-10 h-10 rounded-xl flex items-center justify-center transition-all
            ${camOn
              ? "bg-slate-700 hover:bg-slate-600 text-white"
              : "bg-rose-500 hover:bg-rose-400 text-white"}
          `}
        >
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          {!camOn && (
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-rose-400 whitespace-nowrap font-medium">
              Sem vídeo
            </span>
          )}
        </button>

        {/* Screen share */}
        {onToggleScreen && (
          <button
            onClick={onToggleScreen}
            title={screenOn ? "Parar compartilhamento de tela" : "Compartilhar tela"}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              screenOn
                ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            }`}
          >
            {screenOn ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </button>
        )}

        {/* Settings chevron */}
        <button
          onClick={onOpenSettings}
          title="Configurações de câmera e microfone"
          className="text-slate-400 hover:text-white transition-colors px-0.5 -ml-1"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Right group: star + share + enter + map + profile ── */}
      <div className="flex items-center gap-1 h-[52px] bg-black/50 backdrop-blur-sm rounded-2xl px-2 pointer-events-auto">
        <IconBtn title="Compartilhar link" onClick={onOpenShare}>
          <Share2 className="h-4 w-4" />
        </IconBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Map */}
        <button
          onClick={onOpenMap}
          title="Mapa"
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            mapActive
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/30"
              : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
        >
          <Map className="h-4 w-4" />
        </button>

        {/* Avatar (available to ALL users — guests & visitors persist via localStorage) */}
        {onOpenAvatar && (
          <button
            onClick={onOpenAvatar}
            title="Personalizar avatar"
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-slate-300 hover:text-white hover:bg-white/10"
          >
            <UserRound className="h-4 w-4" />
          </button>
        )}

        {/* Separator */}
        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* User profile chip + status menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setStatusOpen(o => !o)}
            title="Alterar seu status"
            className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="relative w-7 h-7">
              {userImage ? (
                <NextImage
                  src={userImage} alt={userName}
                  fill className="rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={`absolute bottom-0 right-0 w-2 h-2 ${meta.dot} rounded-full border border-slate-900`} />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-white text-xs font-semibold leading-tight max-w-[90px] truncate">{userName}</p>
              <p className={`${meta.text} text-[9px] leading-tight`}>{meta.label}</p>
            </div>
            <ChevronDown className={`h-3 w-3 text-slate-400 ml-0.5 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
          </button>

          {statusOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
              <div className="px-3 pt-1 pb-2">
                <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Alterar seu status</p>
              </div>
              {(Object.keys(STATUS_META) as UserStatus[]).map(key => {
                const m = STATUS_META[key];
                const active = status === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setStatus(key); setStatusOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${m.dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium leading-tight">{m.label}</p>
                      <p className="text-slate-400 text-[10px] leading-tight">{m.description}</p>
                    </div>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
              <div className="border-t border-white/10 mt-2 pt-2">
                <div className="px-3 pb-1">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Perfil</p>
                </div>
                {onOpenAvatar && (
                  <button
                    onClick={() => { onOpenAvatar(); setStatusOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                  >
                    <UserRound className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    <p className="text-white text-xs">Personalizar seu avatar</p>
                  </button>
                )}
                <button
                  onClick={() => { onOpenShare(); setStatusOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  <Users className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  <p className="text-white text-xs">Adicionar companheiro</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── WorldAvatarPill ─────────────────────────────────────────────────────── */
/**
 * Pill de avatares pixel art que substitui o botão "Conectar pessoas".
 * Mantém estado próprio ouvindo os mesmos eventos de presença do mundo.
 */
function WorldAvatarPill({
  localSpriteUrl,
  localName,
  open,
  onClick,
}: {
  localSpriteUrl: string | null;
  localName:      string;
  open:           boolean;
  onClick?:       () => void;
}) {
  const [remotes, setRemotes] = useState<
    Array<{ userId: string; name: string; spriteUrl: string | null }>
  >([]);

  useEffect(() => {
    const onJoin = (e: Event) => {
      const { userId, name, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name: string; spriteUrl?: string | null;
      };
      setRemotes(prev => {
        const exists = prev.findIndex(p => p.userId === userId);
        const entry  = { userId, name, spriteUrl: spriteUrl ?? null };
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = entry;
          return next;
        }
        return [...prev, entry];
      });
    };
    const onLeave = (e: Event) => {
      const { userId } = (e as CustomEvent).detail as { userId: string };
      setRemotes(prev => prev.filter(p => p.userId !== userId));
    };
    const onSprite = (e: Event) => {
      const { userId, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; spriteUrl?: string | null;
      };
      setRemotes(prev =>
        prev.map(p => p.userId === userId ? { ...p, spriteUrl: spriteUrl ?? p.spriteUrl } : p),
      );
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

  // Local + até 2 remotos visíveis no pill
  type PillEntry = { spriteUrl: string | null; name: string };
  const visible: PillEntry[] = [
    { spriteUrl: localSpriteUrl, name: localName },
    ...remotes.slice(0, 2).map(p => ({ spriteUrl: p.spriteUrl, name: p.name })),
  ];
  const totalCount = 1 + remotes.length;
  const extraCount = remotes.length > 2 ? remotes.length - 2 : 0;

  return (
    <button
      onClick={onClick}
      title="Conectar pessoas"
      className={`
        flex items-center gap-1.5 h-9 px-2 rounded-xl transition-all
        ${open
          ? "bg-indigo-500/20 border border-indigo-400/30"
          : "hover:bg-white/10 border border-transparent"}
      `}
    >
      {/* Avatares sobrepostos */}
      <div className="flex items-center">
        {visible.map((p, i) => (
          <div
            key={i}
            className="relative rounded-lg overflow-hidden bg-slate-700 border-2 border-slate-950 flex-shrink-0 flex items-center justify-center"
            style={{
              width:       28,
              height:      28,
              marginLeft:  i === 0 ? 0 : -7,
              zIndex:      visible.length - i,
            }}
          >
            {p.spriteUrl
              ? <AvatarCanvas url={p.spriteUrl} size={28} />
              : <InitialAvatar name={p.name} size={28} />
            }
          </div>
        ))}
        {extraCount > 0 && (
          <div
            className="relative rounded-lg bg-slate-700 border-2 border-slate-950 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
            style={{ width: 28, height: 28, marginLeft: -7, zIndex: 0 }}
          >
            +{extraCount}
          </div>
        )}
      </div>

      {/* Contagem */}
      <span className="text-white text-xs font-semibold tabular-nums">{totalCount}</span>

      {/* Chevron */}
      <ChevronDown
        className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
        active
          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/30"
          : "text-slate-300 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
