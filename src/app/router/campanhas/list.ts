import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

/** Lista as campanhas da org (mais recentes primeiro) com contadores. */
export const list = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const { org } = context;

    const broadcasts = await prisma.broadcast.findMany({
      where: { organizationId: org.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        tracking: { select: { id: true, name: true } },
      },
    });

    return broadcasts;
  });
