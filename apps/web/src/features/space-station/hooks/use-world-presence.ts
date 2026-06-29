"use client";

/**
 * useWorldPresence
 * ─────────────────────────────────────────────────────────────────────────────
 * Multiplayer world presence — bridges Pusher with WorldScene via window events.
 *
 * Outgoing (local → POST /api/pusher/world → Pusher server-side trigger):
 *   space-station:player-moved  →  POST world:moved   (throttled ~8fps)
 *   on join                     →  POST world:joined
 *
 * Incoming (Pusher → window events → WorldScene):
 *   pusher:subscription_succeeded  →  space-station:remote-join  (for each existing member)
 *   pusher:member_added            →  space-station:remote-join  + re-announce self
 *   pusher:member_removed          →  space-station:remote-leave
 *   world:joined                   →  space-station:remote-join
 *   world:moved                    →  space-station:remote-move
 */

import { useEffect, useRef } from "react";

export interface AvatarOverlays {
  eyes?:      string | null;
  hair?:      string | null;
  clothes?:   string | null;
  hat?:       string | null;
  accessory?: string | null;
}

interface Options {
  stationId:  string;
  userId:     string;
  userName:   string;
  userNick?:  string;
  spriteUrl?: string;
  overlays?:  AvatarOverlays;
}

function readSavedPos(stationId: string, userId: string): { x: number; y: number } {
  try {
    const saved = typeof localStorage !== "undefined"
      ? localStorage.getItem(`ss:pos:${stationId}:${userId}`)
      : null;
    if (saved) {
      const p = JSON.parse(saved) as { x: number; y: number };
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.y > 0) return p;
    }
  } catch { /* ignore */ }
  return { x: 500, y: 400 };
}

export function useWorldPresence({ stationId, userId, userName, userNick, spriteUrl, overlays }: Options) {
  const posRef = useRef<{ x: number; y: number }>(readSavedPos(stationId, userId));
  const lastSentRef  = useRef(0);
  const announcedRef = useRef(false);
  // Always expose latest values to triggerServer without re-running the effect
  const spriteUrlRef = useRef(spriteUrl);
  spriteUrlRef.current = spriteUrl;
  const overlaysRef  = useRef<AvatarOverlays | undefined>(overlays);
  overlaysRef.current = overlays;
  const userNickRef  = useRef(userNick);
  userNickRef.current = userNick;

  // ── POST helper ──────────────────────────────────────────────────────────
  function triggerServer(type: "join" | "move", x: number, y: number) {
    fetch("/api/pusher/world", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        type, stationId, userId, name: userName,
        nick:      userNickRef.current  ?? null,
        spriteUrl: spriteUrlRef.current ?? null,
        overlays:  overlaysRef.current  ?? null,
        x, y,
      }),
    }).catch(() => {/* ignore network errors */});
  }

  useEffect(() => {
    let ch: import("pusher-js").PresenceChannel | null = null;
    let pusherInstance: import("pusher-js").default | null = null;

    async function setup() {
      const PusherClient = (await import("pusher-js")).default;

      // Create a per-connection Pusher client that passes the React userId
      // to the auth endpoint so that Pusher member.id === world:joined.userId.
      // This prevents the duplicate-character bug where WorldScene creates two
      // entries — one keyed by Pusher member.id and another by world:joined userId.
      pusherInstance = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
        {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: `/api/pusher/auth?uid=${encodeURIComponent(userId)}`,
        },
      );

      ch = pusherInstance.subscribe(
        `presence-world-${stationId}`,
      ) as import("pusher-js").PresenceChannel;

      // ── Existing members when we join ──────────────────────────────
      ch.bind("pusher:subscription_succeeded", (members: {
        each: (fn: (m: { id: string; info: { name?: string; spriteUrl?: string } }) => void) => void;
      }) => {
        members.each((member) => {
          if (member.id === userId) return;
          window.dispatchEvent(new CustomEvent("space-station:remote-join", {
            detail: {
              userId:    member.id,
              name:      member.info?.name ?? member.id,
              spriteUrl: member.info?.spriteUrl ?? null,
              x: 500, y: 400,
            },
          }));
        });

        // Announce ourselves to everyone after a short delay
        if (!announcedRef.current) {
          announcedRef.current = true;
          setTimeout(() => {
            triggerServer("join", posRef.current.x, posRef.current.y);
          }, 400);
        }
      });

      // ── New member joined — show them + re-announce self ────────────
      ch.bind("pusher:member_added", (member: { id: string; info: { name?: string; spriteUrl?: string } }) => {
        if (member.id === userId) return;
        window.dispatchEvent(new CustomEvent("space-station:remote-join", {
          detail: {
            userId:    member.id,
            name:      member.info?.name ?? member.id,
            spriteUrl: member.info?.spriteUrl ?? null,
            x: 500, y: 400,
          },
        }));
        // Re-announce with current position so the newcomer can see us
        setTimeout(() => {
          triggerServer("join", posRef.current.x, posRef.current.y);
        }, 300);
      });

      // ── Member left ──────────────────────────────────────────────────
      ch.bind("pusher:member_removed", (member: { id: string }) => {
        window.dispatchEvent(new CustomEvent("space-station:remote-leave", {
          detail: { userId: member.id },
        }));
      });

      // ── Remote player announced position (join / re-announce) ───────
      ch.bind("world:joined", (data: { userId: string; name: string; nick?: string | null; spriteUrl?: string; overlays?: AvatarOverlays | null; x: number; y: number }) => {
        if (data.userId === userId) return;
        window.dispatchEvent(new CustomEvent("space-station:remote-join", {
          detail: {
            userId:    data.userId,
            name:      data.name,
            spriteUrl: data.spriteUrl ?? null,
            overlays:  data.overlays  ?? null,
            x: data.x, y: data.y,
          },
        }));
        // Also update the peer spriteUrl in WebRTC (for ProximityBar tiles)
        window.dispatchEvent(new CustomEvent("space-station:peer-sprite", {
          detail: { userId: data.userId, name: data.name, nick: data.nick ?? null, spriteUrl: data.spriteUrl ?? null },
        }));
      });

      // ── Remote player moved ─────────────────────────────────────────
      ch.bind("world:moved", (data: { userId: string; x: number; y: number }) => {
        if (data.userId === userId) return;
        window.dispatchEvent(new CustomEvent("space-station:remote-move", {
          detail: { userId: data.userId, x: data.x, y: data.y },
        }));
      });

      // ── Follow / Conectar eventos ────────────────────────────────────
      // world:follow-request → apenas o destinatário (toUserId) precisa ver
      ch.bind("world:follow-request", (data: {
        fromUserId: string; fromName: string; toUserId: string; x: number; y: number;
      }) => {
        if (data.toUserId !== userId) return;
        window.dispatchEvent(new CustomEvent("space-station:follow-request", {
          detail: { fromUserId: data.fromUserId, fromName: data.fromName, x: data.x, y: data.y },
        }));
      });

      // world:follow-accept → apenas o solicitante original (toUserId) se teleporta
      ch.bind("world:follow-accept", (data: {
        fromUserId: string; toUserId: string; x: number; y: number;
      }) => {
        if (data.toUserId !== userId) return;
        window.dispatchEvent(new CustomEvent("space-station:follow-accept", {
          detail: { fromUserId: data.fromUserId, x: data.x, y: data.y },
        }));
      });

      // world:follow-reject → apenas o solicitante original (toUserId) é notificado
      ch.bind("world:follow-reject", (data: { fromUserId: string; toUserId: string }) => {
        if (data.toUserId !== userId) return;
        window.dispatchEvent(new CustomEvent("space-station:follow-reject", {
          detail: { fromUserId: data.fromUserId },
        }));
      });

      // world:connected → broadcast sem filtro: cada cliente descobre quem é o "outro"
      ch.bind("world:connected", (data: { userId1: string; userId2: string }) => {
        // Só processa se um dos IDs é o nosso
        if (data.userId1 !== userId && data.userId2 !== userId) return;
        const connectedUserId = data.userId1 === userId ? data.userId2 : data.userId1;
        window.dispatchEvent(new CustomEvent("space-station:connected", {
          detail: { connectedUserId },
        }));
      });

      // peer:poked → broadcast sem filtro: todos os clients renderizam 👋
      // acima do avatar do peer cutucado (`toUserId`). O cliente que É o
      // alvo também recebe um toast detalhado com `preview` (vem do
      // `WorldScene` / `space-game.tsx` que ouve o CustomEvent abaixo).
      ch.bind("peer:poked", (data: {
        fromUserId: string;
        fromName: string;
        toUserId: string;
        action: string;
        preview: string | null;
        at: string;
      }) => {
        window.dispatchEvent(new CustomEvent("space-station:peer-poked", {
          detail: data,
        }));
      });
    }

    setup();

    // ── Relay local movement → server → Pusher ──────────────────────
    const posKey = `ss:pos:${stationId}:${userId}`;
    const onPlayerMoved = (e: Event) => {
      const { x, y } = (e as CustomEvent).detail as { x: number; y: number };
      posRef.current = { x, y };

      // Persist position so next page load restores it
      try { localStorage.setItem(posKey, JSON.stringify({ x, y })); } catch { /* ignore */ }

      const now = Date.now();
      if (now - lastSentRef.current < 120) return; // ~8fps
      lastSentRef.current = now;

      triggerServer("move", x, y);
    };

    window.addEventListener("space-station:player-moved", onPlayerMoved);

    return () => {
      window.removeEventListener("space-station:player-moved", onPlayerMoved);
      ch?.unsubscribe();
      pusherInstance?.disconnect();
      pusherInstance = null;
      announcedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, userId]);
}
