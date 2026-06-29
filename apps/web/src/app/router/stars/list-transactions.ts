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
      // Max 200 pra alimentar o popup "Histórico de consumo" do stars-widget
      // (antes o histórico ficava em Permissões com 200 tx fixas).
      limit: z.number().min(1).max(200).default(20),
      offset: z.number().min(0).default(0),
      // Quando true, retorna só débitos (amount<0) — usado pelo histórico
      // de "consumo" no widget. Default false mantém compat com chamadas
      // existentes que listam tudo (créditos + débitos).
      consumptionOnly: z.boolean().optional().default(false),
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
    const where = {
      organizationId: context.org.id,
      ...(input.consumptionOnly ? { amount: { lt: 0 } } : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.starTransaction.findMany({
        where,
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
      prisma.starTransaction.count({ where }),
    ]);

    return { transactions, total };
  });
