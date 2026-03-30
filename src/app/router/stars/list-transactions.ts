import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listStarTransactions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    })
  )
  .output(
    z.object({
      transactions: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          amount: z.number(),
          balanceAfter: z.number(),
          description: z.string(),
          appSlug: z.string().nullable(),
          createdAt: z.date(),
        })
      ),
      total: z.number(),
    })
  )
  .handler(async ({ input, context }) => {
    const [transactions, total] = await Promise.all([
      prisma.starTransaction.findMany({
        where: { organizationId: context.org.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          appSlug: true,
          createdAt: true,
        },
      }),
      prisma.starTransaction.count({
        where: { organizationId: context.org.id },
      }),
    ]);

    return { transactions, total };
  });
