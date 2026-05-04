import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { NasaPlannerPostStatus, StarTransactionType } from "@/generated/prisma/enums";
import { STARS_SCHEDULE } from "./_helpers/ai-provider";
import { inngest } from "@/inngest/client";

export const schedulePostReal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      scheduledAt: z.string().datetime(),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const scheduledDate = new Date(input.scheduledAt);
    if (scheduledDate <= new Date()) {
      throw new ORPCError("BAD_REQUEST", { message: "A data de agendamento deve ser no futuro" });
    }

    const debit = await debitStars(
      context.org.id, STARS_SCHEDULE, StarTransactionType.APP_CHARGE,
      "NASA Planner — agendamento de post", "nasa-planner", context.user.id,
    );
    if (!debit.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de stars insuficiente" });

    const updated = await prisma.nasaPlannerPost.update({
      where: { id: post.id },
      data: {
        status: NasaPlannerPostStatus.SCHEDULED,
        scheduledAt: scheduledDate,
        starsSpent: { increment: STARS_SCHEDULE },
      },
    });

    // Fire Inngest event — will be picked up by the cron or directly
    await inngest.send({
      name: "nasa-planner/publish.post",
      data: {
        postId: post.id,
        organizationId: context.org.id,
        scheduledAt: scheduledDate.toISOString(),
      },
      ts: scheduledDate.getTime(),
    });

    return { post: updated, balanceAfter: debit.newBalance };
  });
