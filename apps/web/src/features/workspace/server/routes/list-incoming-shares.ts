import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listIncomingShares = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ status: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const shares = await prisma.actionShare.findMany({
      where: {
        targetOrgId: context.org.id,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sourceOrg: { select: { id: true, name: true, logo: true } },
        sourceAction: {
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            dueDate: true,
            coverImage: true,
          },
        },
        requester: { select: { id: true, name: true, image: true } },
      },
    });
    return { shares };
  });
