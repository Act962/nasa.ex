import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deletePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.nasaPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!existing) throw new Error("Post não encontrado");

    await prisma.nasaPost.delete({ where: { id: input.postId } });
    return { success: true };
  });
