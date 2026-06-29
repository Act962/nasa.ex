import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const toggleLike = base
  .use(optionalAuthMiddleware)
  .input(z.object({ slug: z.string().min(1), fingerprint: z.string().min(8) }))
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.action.findFirst({
      where: { publicSlug: input.slug, isPublic: true },
      select: { id: true, likesCount: true },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const userId = context.user?.id ?? null;

    const existing = await prisma.actionLike.findFirst({
      where: {
        actionId: event.id,
        OR: [
          ...(userId ? [{ userId }] : []),
          { fingerprint: input.fingerprint, userId: null },
        ],
      },
    });

    if (existing) {
      const [, updated] = await prisma.$transaction([
        prisma.actionLike.delete({ where: { id: existing.id } }),
        prisma.action.update({
          where: { id: event.id },
          data: { likesCount: { decrement: 1 } },
          select: { likesCount: true },
        }),
      ]);
      return { liked: false, likesCount: Math.max(0, updated.likesCount) };
    }

    const [, updated] = await prisma.$transaction([
      prisma.actionLike.create({
        data: {
          actionId: event.id,
          userId,
          fingerprint: userId ? null : input.fingerprint,
        },
      }),
      prisma.action.update({
        where: { id: event.id },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      }),
    ]);
    return { liked: true, likesCount: updated.likesCount };
  });
