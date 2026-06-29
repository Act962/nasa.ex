import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Aprova/esconde review pendente (§7.1 — moderação obrigatória).
 * Reviews nunca são deletadas por aqui (auditoria), só mudam de status.
 */
export const moderateReview = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      reviewId: z.string().min(1),
      status: z.enum(["APPROVED", "HIDDEN", "PENDING"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const review = await prisma.companyReview.findFirst({
      where: { id: input.reviewId, orgId: context.orgId },
      select: { id: true, status: true },
    });
    if (!review) throw errors.NOT_FOUND({ message: "Review não encontrada." });

    const updated = await prisma.companyReview.update({
      where: { id: review.id },
      data: { status: input.status },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        status: true,
        authorName: true,
        createdAt: true,
      },
    });

    await prisma.spacehomeAuditLog
      .create({
        data: {
          orgId: context.orgId,
          actorId: context.user.id,
          action: "review_moderated",
          target: review.id,
          metadata: { from: review.status, to: input.status },
        },
      })
      .catch(() => null);

    return updated;
  });
