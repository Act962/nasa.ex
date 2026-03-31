import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getPosts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plannerId: z.string(),
      status: z.string().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const posts = await prisma.nasaPlannerPost.findMany({
      where: {
        plannerId: input.plannerId,
        organizationId: context.org.id,
        ...(input.status ? { status: input.status as any } : {}),
        ...(input.search
          ? {
              OR: [
                { title: { contains: input.search, mode: "insensitive" } },
                { caption: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { slides: { orderBy: { order: "asc" } } },
    });

    return { posts };
  });
