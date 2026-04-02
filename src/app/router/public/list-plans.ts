/**
 * Public endpoint — no auth required.
 * Used by the marketing landing page to show up-to-date plan data from the DB.
 */
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listPublicPlans = base
  .output(
    z.object({
      plans: z.array(
        z.object({
          id:           z.string(),
          slug:         z.string(),
          name:         z.string(),
          slogan:       z.string().nullable(),
          monthlyStars: z.number(),
          priceMonthly: z.number(),
          rolloverPct:  z.number(),
          benefits:     z.array(z.string()),
          ctaLabel:     z.string(),
          ctaLink:      z.string().nullable(),
          highlighted:  z.boolean(),
          sortOrder:    z.number(),
        })
      ),
    })
  )
  .handler(async () => {
    const rows = await prisma.plan.findMany({
      where:   { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
      select: {
        id: true, slug: true, name: true, slogan: true,
        monthlyStars: true, priceMonthly: true, rolloverPct: true,
        benefits: true, ctaLabel: true, ctaLink: true,
        highlighted: true, sortOrder: true,
      },
    });

    return {
      plans: rows.map((p) => ({
        id:           p.id,
        slug:         p.slug,
        name:         p.name,
        slogan:       p.slogan,
        monthlyStars: p.monthlyStars,
        priceMonthly: Number(p.priceMonthly),
        rolloverPct:  p.rolloverPct,
        benefits:     (p.benefits as string[]) ?? [],
        ctaLabel:     p.ctaLabel,
        ctaLink:      p.ctaLink,
        highlighted:  p.highlighted,
        sortOrder:    p.sortOrder,
      })),
    };
  });
