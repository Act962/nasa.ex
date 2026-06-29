import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Aprova/esconde comentário pendente de CompanyPost.
 * Confirma que o post pertence à org (via join) antes de moderar.
 */
export const moderateComment = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      commentId: z.string().min(1),
      status: z.enum(["APPROVED", "HIDDEN", "PENDING"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const comment = await prisma.companyPostComment.findFirst({
      where: {
        id: input.commentId,
        post: { orgId: context.orgId },
      },
      select: { id: true, status: true },
    });
    if (!comment)
      throw errors.NOT_FOUND({ message: "Comentário não encontrado." });

    const updated = await prisma.companyPostComment.update({
      where: { id: comment.id },
      data: { status: input.status },
    });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "comment_moderated",
          target: comment.id,
          metadata: { from: comment.status, to: input.status },
        },
      })
      .catch(() => null);

    return updated;
  });
