import "server-only";
import prisma from "@/lib/prisma";
import { STAR_FRIENDS_APP_SLUG } from "./constants";

export async function isStarFriendsInstalled(organizationId: string): Promise<boolean> {
  const installation = await prisma.workspaceIntegration.findUnique({
    where: { organizationId_appSlug: { organizationId, appSlug: STAR_FRIENDS_APP_SLUG } },
    select: { isActive: true },
  });
  return !!installation?.isActive;
}

// Programa só vale com o app instalado E ligado nas configurações.
export async function getActiveProgram(organizationId: string) {
  const [isInstalled, program] = await Promise.all([
    isStarFriendsInstalled(organizationId),
    prisma.loyaltyProgram.findUnique({ where: { organizationId } }),
  ]);
  if (!isInstalled || !program?.isActive) return null;
  return program;
}
