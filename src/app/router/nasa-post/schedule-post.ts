import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NasaPostStatus } from "@/generated/prisma/enums";

export const schedulePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      scheduledAt: z.string(), // ISO string
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const post = await prisma.nasaPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw errors.NOT_FOUND({ message: "Post não encontrado" });

    const scheduledDate = new Date(input.scheduledAt);
    if (scheduledDate <= new Date()) {
      throw errors.BAD_REQUEST({ message: "A data de agendamento deve ser no futuro" });
    }

    const updated = await prisma.nasaPost.update({
      where: { id: input.postId },
      data: {
        status: NasaPostStatus.SCHEDULED,
        scheduledAt: scheduledDate,
      },
      include: {
        slides: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    return { post: updated };
  });
