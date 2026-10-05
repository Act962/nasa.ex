import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";

/** Tracking que recebe os leads de cada conta do Instagram no tracking-chat (spec 0062, RF-1; por conta na 0069, RF-16). */

export async function getInstagramLeadTracking(organizationId: string, channelId: string) {
  const [channel, trackings] = await Promise.all([
    prisma.socialChannel.findFirst({ where: { id: channelId, organizationId }, select: { leadTrackingId: true } }),
    prisma.tracking.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!channel) throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
  const chosen = trackings.find((tracking) => tracking.id === channel.leadTrackingId);
  return { trackingId: chosen?.id ?? trackings[0]?.id ?? null, trackings };
}

export async function setInstagramLeadTracking(organizationId: string, channelId: string, trackingId: string) {
  const tracking = await prisma.tracking.findFirst({ where: { id: trackingId, organizationId }, select: { id: true } });
  if (!tracking) throw new ORPCError("BAD_REQUEST", { message: "Tracking não encontrado nesta empresa." });
  const updated = await prisma.socialChannel.updateMany({
    where: { id: channelId, organizationId },
    data: { leadTrackingId: tracking.id },
  });
  if (updated.count === 0) throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
  return { trackingId: tracking.id };
}
