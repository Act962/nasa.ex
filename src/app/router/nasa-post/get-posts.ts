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
      status: z.string().optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const posts = await prisma.nasaPost.findMany({
      where: {
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
      include: {
        slides: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return { posts };
  });
