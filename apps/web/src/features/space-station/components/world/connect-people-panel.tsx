"use client";

/**
 * ConnectPeoplePanel — "Conectar pessoas"
 *
 * Fluxo completo:
 *  1. A clica "Conectar" → POST follow-request (Pusher) → B recebe notificação
 *  2. B clica "Aceitar" → cria UserConnection no DB → POST follow-accept (Pusher)
 *  3. A recebe follow-accept → teleporta + marca "Conectados"
 *  4. Ambos exibem botão verde "Conectados" (persistido no DB + em memória)
 *  5. Ambos ganham acesso às estações um do outro (via StationAccessRequest APPROVED)
 */

import { useEffect, useRef, useState } from "react";
import { UserPlus2, X, Check, Users, Loader2, UserCheck } from "lucide-react";
import { client } from "@/lib/orpc";

/* ─── Avatar canvas (idle-down frame Pipoya) ─────────────────────────────── */

function AvatarCanvas({ url, size = 36 }: { url: string | null; size?: number }) {
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
      ref={ref}
      width={size}
      height={size}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}

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

interface IncomingRequest {
  fromUserId: string;
  fromName:   string;
  x:          number;
  y:          number;
}

interface Props {
  stationId: string;
  userId:    string;   // effectiveUserId — pode ser "guest_…"
  userName:  string;
  open:      boolean;
  onClose:   () => void;
}

/* ─── Componente ─────────────────────────────────────────────────────────── */

export function ConnectPeoplePanel({ stationId, userId, userName, open, onClose }: Props) {
  const isGuest = userId.startsWith("guest");

  const [participants,     setParticipants]     = useState<Map<string, Participant>>(new Map());
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [incomingRequest,  setIncomingRequest]  = useState<IncomingRequest | null>(null);
  const [pendingToUserId,  setPendingToUserId]  = useState<string | null>(null);
  const [loadingId,        setLoadingId]        = useState<string | null>(null);
  const [loadingAccept,    setLoadingAccept]    = useState(false);
  const posRef   = useRef({ x: 500, y: 400 });
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Carregar conexões existentes ao montar (só usuários autenticados) ─── */
  useEffect(() => {
    if (isGuest) return;
    client.spaceStation.listMyConnections().then(list => {
      setConnectedUserIds(new Set(list.map(c => c.userId)));
    }).catch(() => { /* silencioso */ });
  }, [isGuest]);

  /* ── Rastrear posição local do player ──────────────────────────────────── */
  useEffect(() => {
    const onMoved = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };
      posRef.current = { x, y };
    };
    window.addEventListener("space-station:player-moved", onMoved);
    return () => window.removeEventListener("space-station:player-moved", onMoved);
  }, []);

  /* ── Sincronizar lista de participantes (igual ao ParticipantsPanel) ─────── */
  useEffect(() => {
    const onJoin = (e: Event) => {
      const { userId: uid, name, nick, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name: string; nick?: string | null; spriteUrl?: string | null;
      };
      setParticipants(prev => {
        const next = new Map(prev);
        next.set(uid, { userId: uid, name, nick: nick ?? null, spriteUrl: spriteUrl ?? null });
        return next;
      });
    };
    const onLeave = (e: Event) => {
      const { userId: uid } = (e as CustomEvent).detail as { userId: string };
      setParticipants(prev => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
      setPendingToUserId(prev => (prev === uid ? null : prev));
    };
    const onSprite = (e: Event) => {
      const { userId: uid, name, nick, spriteUrl } = (e as CustomEvent).detail as {
        userId: string; name?: string; nick?: string | null; spriteUrl?: string | null;
      };
      setParticipants(prev => {
        if (!prev.has(uid)) return prev;
        const next     = new Map(prev);
        const existing = next.get(uid)!;
        next.set(uid, {
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

  /* ── Eventos de follow (despachados por use-world-presence) ──────────────── */
  useEffect(() => {
    const onRequest = (e: Event) => {
      const { fromUserId, fromName, x, y } = (e as CustomEvent).detail as {
        fromUserId: string; fromName: string; x: number; y: number;
      };
      setIncomingRequest({ fromUserId, fromName, x, y });
    };

    // A (solicitante) recebe follow-accept → só teleporta; "Conectados" vem via world:connected
    const onAccepted = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail as { fromUserId: string; x: number; y: number };
      setPendingToUserId(null);
      setLoadingId(null);
      window.dispatchEvent(new CustomEvent("space-station:teleport-to", { detail: { x, y } }));
    };

    const onRejected = () => {
      setPendingToUserId(null);
      setLoadingId(null);
    };

    // Ambos os lados recebem este evento — atualiza "Conectados" para os dois
    const onConnected = (e: Event) => {
      const { connectedUserId } = (e as CustomEvent).detail as { connectedUserId: string };
      setConnectedUserIds(prev => new Set([...prev, connectedUserId]));
    };

    window.addEventListener("space-station:follow-request", onRequest);
    window.addEventListener("space-station:follow-accept",  onAccepted);
    window.addEventListener("space-station:follow-reject",  onRejected);
    window.addEventListener("space-station:connected",      onConnected);
    return () => {
      window.removeEventListener("space-station:follow-request", onRequest);
      window.removeEventListener("space-station:follow-accept",  onAccepted);
      window.removeEventListener("space-station:follow-reject",  onRejected);
      window.removeEventListener("space-station:connected",      onConnected);
    };
  }, []);

  /* ── Fechar ao clicar fora ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  /* ── Ações ───────────────────────────────────────────────────────────────── */

  async function sendFollowRequest(toUserId: string) {
    if (pendingToUserId) return;
    setLoadingId(toUserId);
    setPendingToUserId(toUserId);
    try {
      await fetch("/api/pusher/world", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "follow-request",
          stationId,
          userId,
          fromUserId: userId,
          fromName:   userName,
          toUserId,
          x: posRef.current.x,
          y: posRef.current.y,
        }),
      });
    } catch {
      setPendingToUserId(null);
    } finally {
      setLoadingId(null);
    }
  }

  async function acceptRequest() {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setLoadingAccept(true);
    setIncomingRequest(null);

    try {
      // 1. Persistir conexão no DB — cria bidirecional + StationAccessRequest (somente auth)
      if (!isGuest) {
        await client.spaceStation.createUserConnection({ connectedUserId: req.fromUserId });
      }

      // 2. Notificar A para teleportar (follow-accept filtrado por toUserId)
      await fetch("/api/pusher/world", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:       "follow-accept",
          stationId,
          userId,
          fromUserId: userId,        // B (quem aceitou)
          toUserId:   req.fromUserId, // A (quem vai teleportar)
          x: posRef.current.x,
          y: posRef.current.y,
        }),
      });

      // 3. Broadcast "Conectados" para AMBOS os lados (sem filtro de toUserId)
      await fetch("/api/pusher/world", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:       "connected",
          stationId,
          userId,
          fromUserId: userId,         // B
          toUserId:   req.fromUserId, // A
        }),
      });
    } catch { /* ignorar erros de rede */ } finally {
      setLoadingAccept(false);
    }
  }

  async function rejectRequest() {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);
    try {
      await fetch("/api/pusher/world", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:       "follow-reject",
          stationId,
          userId,
          fromUserId: userId,
          toUserId:   req.fromUserId,
        }),
      });
    } catch { /* ignorar */ }
  }

  const remoteList = Array.from(participants.values());

  return (
    <>
      {/* ── Notificação de pedido recebido (sempre visível, painel pode estar fechado) ── */}
      {incomingRequest && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 pointer-events-none">
          <div
            className="w-full rounded-2xl border border-indigo-400/20 p-4 shadow-2xl pointer-events-auto"
            style={{
              background:     "linear-gradient(135deg, rgba(15,18,40,0.98) 0%, rgba(30,28,72,0.98) 100%)",
              backdropFilter: "blur(24px)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Pedido de conexão</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  <span className="text-white font-medium">{incomingRequest.fromName}</span>
                  {" "}quer se conectar com você
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={acceptRequest}
                    disabled={loadingAccept}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                  >
                    {loadingAccept
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Check className="h-3.5 w-3.5" />
                    }
                    Aceitar
                  </button>
                  <button
                    onClick={rejectRequest}
                    disabled={loadingAccept}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Recusar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Painel lateral ── */}
      {open && (
        <div
          ref={panelRef}
          className="absolute top-[88px] right-4 z-[90] w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden pointer-events-auto select-none"
          style={{
            background:     "linear-gradient(135deg, rgba(15,18,40,0.98) 0%, rgba(20,24,52,0.98) 100%)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <UserPlus2 className="h-4 w-4 text-indigo-400" />
              <h2 className="text-white text-sm font-semibold">Conectar pessoas</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Descrição */}
          <div className="px-4 py-2.5 bg-indigo-500/5 border-b border-white/5">
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Conecte-se com alguém para se teleportar até ela e visitar seus mundos.
            </p>
          </div>

          {/* Lista */}
          <div className="max-h-[360px] overflow-y-auto">
            {remoteList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 gap-2">
                <Users className="h-8 w-8 text-slate-600" />
                <p className="text-slate-500 text-xs text-center">
                  Nenhum outro participante online
                </p>
              </div>
            ) : (
              remoteList.map(p => {
                const isConnected = connectedUserIds.has(p.userId);
                const isPending   = pendingToUserId === p.userId;
                const isBlocked   = !!pendingToUserId && !isPending;

                return (
                  <div
                    key={p.userId}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
                      {p.spriteUrl
                        ? <AvatarCanvas url={p.spriteUrl} size={36} />
                        : <InitialAvatar name={p.name} size={36} />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{p.name}</p>
                      {p.nick && (
                        <p className="text-slate-400 text-[10px] truncate">@{p.nick}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        <span className="text-[9px] text-slate-500">Online</span>
                      </div>
                    </div>

                    {/* Botão */}
                    {isConnected ? (
                      /* ── Estado: Conectados ── */
                      <div className="flex-shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 text-xs font-medium">
                        <UserCheck className="h-3 w-3" />
                        <span>Conectados</span>
                      </div>
                    ) : isPending ? (
                      /* ── Estado: Aguardando resposta ── */
                      <div className="flex-shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-400/30 text-xs font-medium cursor-wait">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Aguardando</span>
                      </div>
                    ) : (
                      /* ── Estado: Conectar ── */
                      <button
                        onClick={() => !isBlocked && sendFollowRequest(p.userId)}
                        disabled={isBlocked}
                        title="Enviar pedido de conexão"
                        className={`
                          flex-shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all
                          ${isBlocked
                            ? "opacity-40 cursor-not-allowed bg-white/5 text-slate-400 border border-white/10"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"}
                        `}
                      >
                        {loadingId === p.userId
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <UserPlus2 className="h-3 w-3" />
                        }
                        <span>Conectar</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé — contagem de conexões */}
          {connectedUserIds.size > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 bg-emerald-500/5">
              <p className="text-emerald-400 text-[11px] flex items-center gap-1.5">
                <UserCheck className="h-3 w-3" />
                {connectedUserIds.size} {connectedUserIds.size === 1 ? "conexão estabelecida" : "conexões estabelecidas"}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
