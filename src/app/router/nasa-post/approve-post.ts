import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { z } from "zod";
import { NasaPostStatus, StarTransactionType } from "@/generated/prisma/enums";

const STARS_PER_APPROVAL = 2;

export const approvePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const post = await prisma.nasaPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw errors.NOT_FOUND({ message: "Post não encontrado" });

    const debit = await debitStars(
      context.org.id,
      STARS_PER_APPROVAL,
      StarTransactionType.APP_CHARGE,
      `NASA Post — aprovação de post`,
      "nasa-post",
    );
    if (!debit.success) {
      throw errors.BAD_REQUEST({ message: "Saldo de stars insuficiente para aprovar o post" });
    }

    const updated = await prisma.nasaPost.update({
      where: { id: input.postId },
      data: {
        status: NasaPostStatus.APPROVED,
        starsSpent: { increment: STARS_PER_APPROVAL },
      },
      include: {
        slides: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    return { post: updated, starsSpent: STARS_PER_APPROVAL, balanceAfter: debit.newBalance };
  });
