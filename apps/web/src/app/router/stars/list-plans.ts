import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listPlans = base
  .use(requiredAuthMiddleware)
  .output(z.object({
    plans: z.array(z.object({
      id:           z.string(),
      slug:         z.string(),
      name:         z.string(),
      slogan:       z.string().nullable(),
      sortOrder:    z.number(),
      monthlyStars: z.number(),
      priceMonthly: z.number(),
      billingType:  z.string(),
      maxUsers:     z.number(),
      benefits:     z.array(z.string()),
      ctaLabel:     z.string(),
      ctaLink:      z.string().nullable(),
      ctaGatewayId: z.string().nullable(),
      highlighted:  z.boolean(),
    })),
  }))
  .handler(async () => {
    const plans = await prisma.plan.findMany({
      where:   { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
      select: {
        id: true, slug: true, name: true, slogan: true, sortOrder: true,
        monthlyStars: true, priceMonthly: true, billingType: true,
        maxUsers: true, benefits: true, ctaLabel: true, ctaLink: true,
        ctaGatewayId: true, highlighted: true,
      },
    });

    return {
      plans: plans.map((p) => ({
        id:           p.id,
        slug:         p.slug,
        name:         p.name,
        slogan:       p.slogan,
        sortOrder:    p.sortOrder,
        monthlyStars: p.monthlyStars,
        priceMonthly: Number(p.priceMonthly),
        billingType:  p.billingType,
        maxUsers:     p.maxUsers,
        benefits:     (p.benefits as string[]) ?? [],
        ctaLabel:     p.ctaLabel,
        ctaLink:      p.ctaLink,
        ctaGatewayId: p.ctaGatewayId,
        highlighted:  p.highlighted,
      })),
    };
  });
