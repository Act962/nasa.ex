import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listUsers = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List users", tags: ["Admin"] })
  .input(z.object({
    search: z.string().optional(),
    page:   z.coerce.number().int().positive().default(1),
    limit:  z.coerce.number().int().positive().max(100).default(25),
  }))
  .output(z.object({
    users: z.array(z.object({
      id:            z.string(),
      name:          z.string(),
      email:         z.string(),
      image:         z.string().nullable(),
      isSystemAdmin: z.boolean(),
      createdAt:     z.string(),
      membersCount:  z.number(),
    })),
    total: z.number(),
  }))
  .handler(async ({ input }) => {
    const { search, page, limit } = input;
    const where = search
      ? { OR: [
          { name:  { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, email: true, image: true,
          isSystemAdmin: true, createdAt: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id:            u.id,
        name:          u.name,
        email:         u.email,
        image:         u.image ?? null,
        isSystemAdmin: u.isSystemAdmin,
        createdAt:     u.createdAt.toISOString(),
        membersCount:  u._count.members,
      })),
      total,
    };
  });
