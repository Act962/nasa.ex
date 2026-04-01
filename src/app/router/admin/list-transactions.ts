import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listTransactions = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List all star transactions", tags: ["Admin"] })
  .input(z.object({
    orgId: z.string().optional(),
    type: z.string().optional(),
    page: z.number().default(1),
    limit: z.number().default(30),
  }))
  .output(z.object({
    transactions: z.array(z.object({
      id: z.string(),
      orgId: z.string(),
      orgName: z.string(),
      type: z.string(),
      amount: z.number(),
      balanceAfter: z.number(),
      description: z.string(),
      appSlug: z.string().nullable(),
      createdAt: z.date(),
    })),
    total: z.number(),
  }))
  .handler(async ({ input }) => {
    const { orgId, type, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(type ? { type: type as never } : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.starTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          description: true,
          appSlug: true,
          createdAt: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.starTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        orgId: t.organizationId,
        orgName: t.organization.name,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        appSlug: t.appSlug,
        createdAt: t.createdAt,
      })),
      total,
    };
  });
