import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listOrganizations = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List all organizations", tags: ["Admin"] })
  .input(z.object({
    search: z.string().optional(),
    planId: z.string().optional(),
    page: z.number().default(1),
    limit: z.number().default(20),
  }))
  .output(z.object({
    organizations: z.array(z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      logo: z.string().nullable(),
      starsBalance: z.number(),
      planId: z.string().nullable(),
      planName: z.string().nullable(),
      memberCount: z.number(),
      createdAt: z.date(),
    })),
    total: z.number(),
  }))
  .handler(async ({ input }) => {
    const { search, planId, page, limit } = input;
    const skip = (page - 1) * limit;

    const where = {
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(planId ? { planId } : {}),
    };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          starsBalance: true,
          planId: true,
          plan: { select: { name: true } },
          createdAt: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        logo: o.logo,
        starsBalance: o.starsBalance,
        planId: o.planId,
        planName: o.plan?.name ?? null,
        memberCount: o._count.members,
        createdAt: o.createdAt,
      })),
      total,
    };
  });
