import { meterOrThrow } from "@/features/stars/lib/metering";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
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

    const debit = await meterOrThrow({
      organizationId: context.org.id,
      action: "planner_post_schedule",
      userId: context.user.id,
      appSlug: "nasa-planner",
      description: "NASA Planner — agendamento de post",
      feature: "planner.post.schedule",
    }, "Saldo de stars insuficiente");

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

    return { post: updated, balanceAfter: debit.balanceAfter };
  });
