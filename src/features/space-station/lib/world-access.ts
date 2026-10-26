// Regra única de quem pode estar no mundo de uma station (join-world e relay /api/pusher/world).
import prisma from "@/lib/prisma";
import type { StationAccessMode, StationType } from "@/generated/prisma/enums";

export interface WorldStation {
  id: string;
  type: StationType;
  userId: string | null;
  orgId: string | null;
  accessMode: StationAccessMode;
  isPublic: boolean;
}

export type WorldAccess =
  | { isAllowed: false }
  | { isAllowed: true; isOwner: boolean };

export const GUEST_WORLD_ID_PATTERN = /^guest[a-zA-Z0-9_-]*$/;

export function canGuestEnterWorld(station: WorldStation): boolean {
  return station.isPublic && station.accessMode === "OPEN";
}

export async function resolveWorldAccess(
  station: WorldStation,
  userId: string,
): Promise<WorldAccess> {
  const isUserOwner = station.type === "USER" && station.userId === userId;
  let isOrgMember = false;
  if (station.type === "ORG" && station.orgId) {
    const member = await prisma.member.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: station.orgId },
      },
      select: { id: true },
    });
    isOrgMember = Boolean(member);
  }
  const isOwner = isUserOwner || isOrgMember;
  if (isOwner) return { isAllowed: true, isOwner };

  // Station oculta não é acessível a não-donos (espelha checkStationAccess,
  // que só encontra a station com isPublic:true).
  if (!station.isPublic) return { isAllowed: false };
  if (station.accessMode === "OPEN") return { isAllowed: true, isOwner };

  if (station.type === "USER" && station.userId) {
    const connection = await prisma.userConnection.findUnique({
      where: {
        userId_connectedId: { userId, connectedId: station.userId },
      },
      select: { id: true },
    });
    if (connection) return { isAllowed: true, isOwner };
  }
  if (station.accessMode === "REQUEST") {
    const accessRequest = await prisma.stationAccessRequest.findUnique({
      where: { stationId_userId: { stationId: station.id, userId } },
      select: { status: true },
    });
    if (accessRequest?.status === "APPROVED") {
      return { isAllowed: true, isOwner };
    }
  }
  return { isAllowed: false };
}
