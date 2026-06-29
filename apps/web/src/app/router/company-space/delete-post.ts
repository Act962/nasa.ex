import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Remove um CompanyPost. Cascade remove comments (FK onDelete: Cascade).
 */
export const deletePost = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      postId: z.string().min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.companyPost.findFirst({
      where: { id: input.postId, orgId: context.orgId },
      select: { id: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Post não encontrado." });

    await prisma.companyPost.delete({ where: { id: existing.id } });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "post_deleted",
          target: existing.id,
        },
      })
      .catch(() => null);

    return { ok: true };
  });
