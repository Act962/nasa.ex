import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";

export const getOnlineUsers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
      select: { role: true },
    });

    if (!member || member.role === "member") {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas Master, Adm e Moderador podem ver usuários online.",
      });
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const online = await prisma.userPresence.findMany({
      where: { organizationId: context.org.id, lastSeenAt: { gte: fiveMinAgo } },
      orderBy: { lastSeenAt: "desc" },
    });
    return { online, count: online.length };
  });
