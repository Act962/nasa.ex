import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getActivityNow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      orgIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const memberships = await prisma.member.findMany({
      where: { userId: context.user.id },
      select: { organizationId: true, role: true },
    });
    const myOrgIds = memberships.map((m) => m.organizationId);
    const requestedOrgs = (input.orgIds && input.orgIds.length > 0)
      ? input.orgIds.filter((id) => myOrgIds.includes(id))
      : myOrgIds;

    if (requestedOrgs.length === 0) return { now: [], count: 0 };

    const isMemberOnly = memberships.every((m) => m.role === "member");

    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

    const presence = await prisma.userPresence.findMany({
      where: {
        organizationId: { in: requestedOrgs },
        lastSeenAt: { gte: twoMinAgo },
        ...(isMemberOnly ? { userId: context.user.id } : {}),
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const now = presence.map((p) => ({
      userId: p.userId,
      name: p.userName,
      email: p.userEmail,
      image: p.userImage,
      organizationId: p.organizationId,
      activeAppSlug: p.activeAppSlug,
      activePath: p.activePath,
      activeResource: p.activeResource,
      lastSeenAt: p.lastSeenAt,
    }));

    return { now, count: now.length };
  });
