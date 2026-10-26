import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import {
  canGuestEnterWorld,
  GUEST_WORLD_ID_PATTERN,
  resolveWorldAccess,
} from "@/features/space-station/lib/world-access";

/**
 * POST /api/pusher/world
 * Server-side trigger for world presence events.
 * Avoids the need for "Enable client events" in the Pusher dashboard.
 *
 * Quem publica vem da sessão (better-auth), nunca do body. Sem sessão só
 * convidado (`guest*`) em station aberta e pública, como no join-world.
 */

// Teto defensivo: o tamanho exato do mapa "tiled" só existe no cliente, e ler
// o mapData a cada movimento (~8/s por jogador) custaria caro.
const WORLD_MAX_PX = 16384;

const overlaySchema = z
  .object({
    eyes: z.string().nullish(),
    hair: z.string().nullish(),
    clothes: z.string().nullish(),
    hat: z.string().nullish(),
    accessory: z.string().nullish(),
  })
  .nullish();

const bodySchema = z.object({
  type: z.enum([
    "join",
    "move",
    "screen",
    "follow-request",
    "follow-accept",
    "follow-reject",
    "connected",
  ]),
  stationId: z.string().min(1),
  userId: z.string().optional(),
  name: z.string().max(120).optional(),
  nick: z.string().max(120).nullish(),
  spriteUrl: z.string().nullish(),
  overlays: overlaySchema,
  x: z.number().optional(),
  y: z.number().optional(),
  screenOn: z.boolean().optional(),
  fromName: z.string().max(120).optional(),
  toUserId: z.string().optional(),
});

function clampToWorld(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, 0), WORLD_MAX_PX);
}

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { type, stationId, name, nick, spriteUrl, overlays, screenOn, fromName, toUserId } =
      parsed.data;
    const x = clampToWorld(parsed.data.x);
    const y = clampToWorld(parsed.data.y);

    const station = await prisma.spaceStation.findUnique({
      where: { id: stationId },
      select: {
        id: true,
        type: true,
        userId: true,
        orgId: true,
        accessMode: true,
        isPublic: true,
      },
    });

    const session = await auth.api.getSession({ headers: req.headers });
    let userId: string;
    if (session) {
      if (!station) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const access = await resolveWorldAccess(station, session.user.id);
      if (!access.isAllowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      userId = session.user.id;
    } else {
      const guestId = parsed.data.userId ?? "";
      if (
        !station ||
        !canGuestEnterWorld(station) ||
        !GUEST_WORLD_ID_PATTERN.test(guestId)
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = guestId;
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
        fromUserId: userId, fromName, toUserId,
        // requester's current position (so accepter knows where to go)
        x, y,
      });
    } else if (type === "follow-accept") {
      // fromUserId = who accepted; toUserId = original requester
      // x,y = accepter's current position (requester teleports here)
      await pusherServer.trigger(channel, "world:follow-accept", {
        fromUserId: userId, toUserId, x, y,
      });
    } else if (type === "follow-reject") {
      await pusherServer.trigger(channel, "world:follow-reject", {
        fromUserId: userId, toUserId,
      });
    } else if (type === "connected") {
      // Broadcast sem filtro — ambos os lados atualizam o estado "Conectados"
      await pusherServer.trigger(channel, "world:connected", {
        userId1: userId,    // quem aceitou
        userId2: toUserId,  // quem enviou o pedido
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pusher/world] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
