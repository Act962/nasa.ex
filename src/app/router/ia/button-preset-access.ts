import prisma from "@/lib/prisma";

// Menus de botões do atendimento só são lidos e alterados por quem é da empresa dona do funil.
// Sem isso, qualquer usuário logado mexia no menu enviado aos clientes de outra empresa pelo id.

export async function canAccessTrackingMenus(trackingId: string, userId: string): Promise<boolean> {
  const tracking = await prisma.tracking.findUnique({ where: { id: trackingId }, select: { organizationId: true } });
  if (!tracking) return false;
  const member = await prisma.member.findFirst({ where: { organizationId: tracking.organizationId, userId }, select: { id: true } });
  return Boolean(member);
}

export async function canAccessMenu(menuId: string, userId: string): Promise<boolean> {
  const menu = await prisma.aiButtonPreset.findUnique({ where: { id: menuId }, select: { trackingId: true } });
  return menu ? canAccessTrackingMenus(menu.trackingId, userId) : false;
}
