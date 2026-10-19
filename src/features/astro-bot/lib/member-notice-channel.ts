import "server-only";
import prisma from "@/lib/prisma";

/** Número e tracking por onde o aviso sai: o número liberado da pessoa e um funil habilitado para o ASTRO. */
export async function resolveNoticeChannel(params: { userId: string; organizationId: string }) {
  const binding = await prisma.userWhatsappBinding.findFirst({
    where: { userId: params.userId, organizationId: params.organizationId, isActive: true, botConfig: { isActive: true } },
    select: { phoneE164: true, organizationBotConfigId: true },
  });
  if (!binding) return null;
  const enabledTracking = await prisma.astroBotTracking.findFirst({
    where: { botConfigId: binding.organizationBotConfigId, tracking: { isArchived: false } },
    orderBy: { createdAt: "asc" },
    select: { trackingId: true },
  });
  return enabledTracking ? { phone: binding.phoneE164, trackingId: enabledTracking.trackingId } : null;
}
