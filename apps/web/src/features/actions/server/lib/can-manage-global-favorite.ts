import prisma from "@/lib/prisma";

export const GLOBAL_FAVORITE_ROLES = ["owner", "admin", "moderador"] as const;
export type GlobalFavoriteRole = (typeof GLOBAL_FAVORITE_ROLES)[number];

export async function canManageGlobalFavorite(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!member) return false;
  return (GLOBAL_FAVORITE_ROLES as readonly string[]).includes(member.role);
}
