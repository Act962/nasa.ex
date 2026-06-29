import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

/**
 * POST /api/pusher/world
 * Server-side trigger for world presence events.
 * Avoids the need for "Enable client events" in the Pusher dashboard.
 *
 * Body: { type: "join" | "move", stationId, userId, name, spriteUrl?, x, y }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type:       "join" | "move" | "screen" | "follow-request" | "follow-accept" | "follow-reject" | "connected";
      stationId:  string;
      userId:     string;
      name?:      string;
      nick?:      string | null;
      spriteUrl?: string | null;
      overlays?:  {
        eyes?:      string | null;
        hair?:      string | null;
        clothes?:   string | null;
        hat?:       string | null;
        accessory?: string | null;
      } | null;
      x?:         number;
      y?:         number;
      screenOn?:  boolean;
      // follow-request / follow-accept / follow-reject
      fromUserId?: string;
      fromName?:   string;
      toUserId?:   string;
    };

    const {
      type, stationId, userId, name, nick, spriteUrl, overlays, x, y, screenOn,
      fromUserId, fromName, toUserId,
    } = body;

    if (!type || !stationId || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const channel = `presence-world-${stationId}`;

    if (type === "join") {
      await pusherServer.trigger(channel, "world:joined", {
        userId, name,
        nick:      nick      ?? null,
        spriteUrl: spriteUrl ?? null,
        overlays:  overlays  ?? null,
        x, y,
      });
    } else if (type === "move") {
      await pusherServer.trigger(channel, "world:moved", {
        userId, x, y,
      });
    } else if (type === "screen") {
      await pusherServer.trigger(`private-rtc-${stationId}`, "world:screen", {
        userId, screenOn: screenOn ?? false,
      });
    } else if (type === "follow-request") {
      // Broadcast to everyone — each client filters by toUserId
      await pusherServer.trigger(channel, "world:follow-request", {
        fromUserId, fromName, toUserId,
        // requester's current position (so accepter knows where to go)
        x, y,
      });
    } else if (type === "follow-accept") {
      // fromUserId = who accepted; toUserId = original requester
      // x,y = accepter's current position (requester teleports here)
      await pusherServer.trigger(channel, "world:follow-accept", {
        fromUserId, toUserId, x, y,
      });
    } else if (type === "follow-reject") {
      await pusherServer.trigger(channel, "world:follow-reject", {
        fromUserId, toUserId,
      });
    } else if (type === "connected") {
      // Broadcast sem filtro — ambos os lados atualizam o estado "Conectados"
      await pusherServer.trigger(channel, "world:connected", {
        userId1: fromUserId,  // quem aceitou
        userId2: toUserId,    // quem enviou o pedido
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pusher/world] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
