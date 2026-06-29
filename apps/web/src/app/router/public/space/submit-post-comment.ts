import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Submissão de comentário em post — moderação obrigatória (PENDING).
 */
export const submitPostComment = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      postSlug: z.string().min(1),
      content: z.string().min(1).max(2000),
      parentId: z.string().optional(),
      authorName: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { organization } = context;

    const post = await prisma.companyPost.findFirst({
      where: {
        slug: input.postSlug,
        orgId: organization.id,
        isPublished: true,
      },
      select: { id: true },
    });
    if (!post) throw errors.NOT_FOUND({ message: "Post não encontrado." });

    const sessionData = await auth.api.getSession({ headers: context.headers });
    const authorId = sessionData?.user?.id ?? null;

    const ip =
      context.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      context.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = createHash("sha256").update(ip).digest("hex");

    const comment = await prisma.companyPostComment.create({
      data: {
        postId: post.id,
        authorId,
        authorName: input.authorName ?? null,
        content: input.content,
        parentId: input.parentId ?? null,
        status: "PENDING",
      },
      select: { id: true, status: true },
    });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: organization.id,
          actorId: authorId,
          action: "comment_submitted",
          target: comment.id,
          ipHash,
        },
      })
      .catch(() => null);

    return { commentId: comment.id, status: comment.status };
  });
