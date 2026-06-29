import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listPlans = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List plans", tags: ["Admin"] })
  .output(z.object({
    plans: z.array(z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      monthlyStars: z.number(),
      priceMonthly: z.number(),
      maxUsers: z.number(),
      rolloverPct: z.number(),
      isActive: z.boolean(),
      orgCount: z.number(),
    })),
  }))
  .handler(async () => {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      select: {
        id: true, slug: true, name: true, monthlyStars: true,
        priceMonthly: true, maxUsers: true, rolloverPct: true, isActive: true,
        _count: { select: { organizations: true } },
      },
    });

    return {
      plans: plans.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        monthlyStars: p.monthlyStars,
        priceMonthly: Number(p.priceMonthly),
        maxUsers: p.maxUsers,
        rolloverPct: p.rolloverPct,
        isActive: p.isActive,
        orgCount: p._count.organizations,
      })),
    };
  });
