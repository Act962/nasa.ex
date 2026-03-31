import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const schedulePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      scheduledAt: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt < new Date()) {
      throw new ORPCError("BAD_REQUEST", { message: "Data de agendamento deve ser no futuro" });
    }

    const post = await prisma.nasaPlannerPost.update({
      where: { id: input.postId, organizationId: context.org.id },
      data: { status: "SCHEDULED", scheduledAt },
    });

    return { post };
  });
