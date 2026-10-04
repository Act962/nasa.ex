import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";

/** Tracking que recebe os leads do Instagram no tracking-chat (spec 0062, RF-1). */

export async function getInstagramLeadTracking(organizationId: string) {
  const [channel, trackings] = await Promise.all([
    prisma.socialChannel.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { leadTrackingId: true } }),
    prisma.tracking.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  const chosen = trackings.find((tracking) => tracking.id === channel?.leadTrackingId);
  return { trackingId: chosen?.id ?? trackings[0]?.id ?? null, trackings };
}

export async function setInstagramLeadTracking(organizationId: string, trackingId: string) {
  const tracking = await prisma.tracking.findFirst({ where: { id: trackingId, organizationId }, select: { id: true } });
  if (!tracking) throw new ORPCError("BAD_REQUEST", { message: "Tracking não encontrado nesta empresa." });
  const channel = await prisma.socialChannel.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!channel) throw new ORPCError("BAD_REQUEST", { message: "Conecte o Instagram antes de escolher o tracking." });
  await prisma.socialChannel.update({ where: { id: channel.id }, data: { leadTrackingId: tracking.id } });
  return { trackingId: tracking.id };
}
