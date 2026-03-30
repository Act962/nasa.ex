import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getStorage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const result = await prisma.nBoxItem.aggregate({
      where: { organizationId: context.org.id, size: { not: null } },
      _sum: { size: true },
      _count: true,
    });

    const org = await prisma.organization.findUnique({
      where: { id: context.org.id },
      include: { plan: true },
    });

    const planSlug = org?.plan?.slug ?? "earth";
    const limitMap: Record<string, number> = {
      earth: 500 * 1024 * 1024,
      explore: 2 * 1024 * 1024 * 1024,
      constellation: 10 * 1024 * 1024 * 1024,
    };
    const limitBytes = limitMap[planSlug] ?? 500 * 1024 * 1024;

    return {
      usedBytes: result._sum.size ?? 0,
      limitBytes,
      itemCount: result._count,
      planSlug,
    };
  });
