import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listOutgoingShares = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ status: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const shares = await prisma.actionShare.findMany({
      where: {
        sourceOrgId: context.org.id,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        targetOrg: { select: { id: true, name: true, logo: true } },
        sourceAction: { select: { id: true, title: true } },
        requester: { select: { id: true, name: true, image: true } },
      },
    });
    return { shares };
  });
