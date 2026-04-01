import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { StarTransactionType } from "@/generated/prisma/enums";
import { z } from "zod";

export const adjustStars = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Adjust stars balance", tags: ["Admin"] })
  .input(z.object({
    orgId: z.string(),
    amount: z.number().int().refine((n) => n !== 0, "Amount cannot be zero"),
    description: z.string().min(1).max(200),
  }))
  .output(z.object({ newBalance: z.number(), transactionId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { orgId, amount, description } = input;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, starsBalance: true },
    });

    if (!org) throw errors.NOT_FOUND;

    const newBalance = Math.max(0, org.starsBalance + amount);

    const [updatedOrg, tx] = await prisma.$transaction([
      prisma.organization.update({
        where: { id: orgId },
        data: { starsBalance: newBalance },
        select: { starsBalance: true },
      }),
      prisma.starTransaction.create({
        data: {
          organizationId: orgId,
          type: StarTransactionType.MANUAL_ADJUST,
          amount,
          balanceAfter: newBalance,
          description: `[Admin: ${context.adminUser.email}] ${description}`,
        },
        select: { id: true },
      }),
    ]);

    return { newBalance: updatedOrg.starsBalance, transactionId: tx.id };
  });
