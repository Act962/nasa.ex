import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getOnlineUsers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const online = await prisma.userPresence.findMany({
      where: { organizationId: context.org.id, lastSeenAt: { gte: fiveMinAgo } },
      orderBy: { lastSeenAt: "desc" },
    });
    return { online, count: online.length };
  });
