import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listPlans = base
  .use(requiredAuthMiddleware)
  .output(
    z.object({
      plans: z.array(
        z.object({
          id: z.string(),
          slug: z.string(),
          name: z.string(),
          monthlyStars: z.number(),
          priceMonthly: z.number(),
          maxUsers: z.number(),
        })
      ),
    })
  )
  .handler(async () => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
      select: { id: true, slug: true, name: true, monthlyStars: true, priceMonthly: true, maxUsers: true },
    });

    return {
      plans: plans.map((p) => ({
        ...p,
        priceMonthly: Number(p.priceMonthly),
      })),
    };
  });
