import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import z from "zod";

export type AccessResult = "OPEN" | "MEMBER" | "OWNER" | "PENDING" | "REJECTED" | "NONE";

/**
 * Retorna o status de acesso do usuário atual ao Space Station identificado por `nick`.
 * - OPEN: a station está aberta a qualquer um
 * - OWNER: usuário dono da station (USER) ou membro da org dona (ORG)
 * - MEMBER: usuário é Member da Organization dona
 * - PENDING / REJECTED: existe StationAccessRequest com este status
 * - NONE: sem acesso, sem pedido
 */
export const checkStationAccess = base
  .route({
    method: "GET",
    path: "/space-station/{nick}/access",
    summary: "Check current user's access status to a station",
  })
  .input(z.object({ nick: z.string() }))
  .handler(async ({ input }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user.id ?? null;

    const station = await prisma.spaceStation.findUnique({
      where: { nick: input.nick, isPublic: true },
      select: { id: true, type: true, userId: true, orgId: true, accessMode: true },
    });
    if (!station) return { status: "NONE" as AccessResult, stationId: null };

    if (station.accessMode === "OPEN") return { status: "OPEN" as AccessResult, stationId: station.id };

    if (!userId) return { status: "NONE" as AccessResult, stationId: station.id };

    // Owner check
    if (station.type === "USER" && station.userId === userId) {
      return { status: "OWNER" as AccessResult, stationId: station.id };
    }
    if (station.type === "ORG" && station.orgId) {
      const m = await prisma.member.findUnique({
        where: { userId_organizationId: { userId, organizationId: station.orgId } },
        select: { id: true },
      });
      if (m) return { status: "MEMBER" as AccessResult, stationId: station.id };
    }

    if (station.accessMode === "MEMBERS_ONLY") {
      // Conexão bidirecional também concede acesso em estações MEMBERS_ONLY
      if (station.type === "USER" && station.userId) {
        const connection = await prisma.userConnection.findUnique({
          where: { userId_connectedId: { userId, connectedId: station.userId } },
          select: { id: true },
        });
        if (connection) return { status: "MEMBER" as AccessResult, stationId: station.id };
      }
      return { status: "NONE" as AccessResult, stationId: station.id };
    }

    // Conexão bidirecional também concede acesso em modo REQUEST sem precisar de pedido
    if (station.type === "USER" && station.userId) {
      const connection = await prisma.userConnection.findUnique({
        where: { userId_connectedId: { userId, connectedId: station.userId } },
        select: { id: true },
      });
      if (connection) return { status: "MEMBER" as AccessResult, stationId: station.id };
    }

    // REQUEST mode — look up latest request
    const req = await prisma.stationAccessRequest.findUnique({
      where: { stationId_userId: { stationId: station.id, userId } },
      select: { status: true },
    });
    if (req?.status === "PENDING")  return { status: "PENDING"  as AccessResult, stationId: station.id };
    if (req?.status === "APPROVED") return { status: "MEMBER"   as AccessResult, stationId: station.id };
    if (req?.status === "REJECTED") return { status: "REJECTED" as AccessResult, stationId: station.id };
    return { status: "NONE" as AccessResult, stationId: station.id };
  });
