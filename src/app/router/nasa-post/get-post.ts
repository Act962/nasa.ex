import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getPost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
      include: {
        slides: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });
    if (!post) throw new Error("Post não encontrado");
    return { post };
  });
