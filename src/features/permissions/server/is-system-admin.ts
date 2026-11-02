import "server-only";
import prisma from "@/lib/prisma";

/** Admin do sistema (equipe Órbita), lido do banco a cada chamada — nunca do cache da sessão. */
export async function isUserSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSystemAdmin: true } });
  return Boolean(user?.isSystemAdmin);
}
