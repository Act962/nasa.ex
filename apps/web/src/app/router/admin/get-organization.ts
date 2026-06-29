import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

// SECURITY: never select API keys, tokens, passwords, or any sensitive credentials
const FORBIDDEN_FIELDS = ["anthropicApiKey", "accessToken", "refreshToken", "apiKey", "secret"];

export const getOrganization = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — Get organization detail", tags: ["Admin"] })
  .input(z.object({ orgId: z.string() }))
  .output(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable(),
    starsBalance: z.number(),
    planId: z.string().nullable(),
    plan: z.object({ id: z.string(), name: z.string(), monthlyStars: z.number(), priceMonthly: z.number() }).nullable(),
    members: z.array(z.object({
      id: z.string(),
      role: z.string(),
      createdAt: z.date(),
      user: z.object({ id: z.string(), name: z.string(), email: z.string(), isSystemAdmin: z.boolean(), image: z.string().nullable() }),
    })),
    recentTransactions: z.array(z.object({
      id: z.string(),
      type: z.string(),
      amount: z.number(),
      balanceAfter: z.number(),
      description: z.string(),
      createdAt: z.date(),
    })),
    createdAt: z.date(),
    metadata: z.string().nullable(),
  }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        starsBalance: true,
        planId: true,
        metadata: true,
        createdAt: true,
        plan: { select: { id: true, name: true, monthlyStars: true, priceMonthly: true } },
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true, isSystemAdmin: true, image: true } },
          },
        },
        starTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, type: true, amount: true, balanceAfter: true, description: true, createdAt: true },
        },
      },
    });

    if (!org) throw errors.NOT_FOUND;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      starsBalance: org.starsBalance,
      planId: org.planId,
      metadata: org.metadata,
      createdAt: org.createdAt,
      plan: org.plan
        ? { ...org.plan, priceMonthly: Number(org.plan.priceMonthly) }
        : null,
      members: org.members,
      recentTransactions: org.starTransactions,
    };
  });
