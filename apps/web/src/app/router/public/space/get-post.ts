import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PUBLIC_USER_SELECT } from "@/features/space-page/utils/public-selectors";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

export const getPost = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1), slug: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const post = await prisma.companyPost.findFirst({
      where: {
        slug: input.slug,
        orgId: context.organization.id,
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverUrl: true,
        publishedAt: true,
        viewCount: true,
        author: { select: PUBLIC_USER_SELECT },
      },
    });
    if (!post) throw errors.NOT_FOUND({ message: "Post não encontrado." });

    const comments = await prisma.companyPostComment.findMany({
      where: { postId: post.id, status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        parentId: true,
        authorName: true,
        content: true,
        createdAt: true,
        author: { select: PUBLIC_USER_SELECT },
      },
    });

    return { post, comments };
  });
