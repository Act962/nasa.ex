import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

export const listBadges = base
  .use(requiredAuthMiddleware)
  .handler(async () => {
    const badges = await prisma.spaceHelpBadge.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return { badges };
  });
