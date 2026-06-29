import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const recordView = base
  .use(optionalAuthMiddleware)
  .input(
    z.object({
      slug: z.string().min(1),
      fingerprint: z.string().min(8),
      sharerToken: z.string().optional(),
      referrer: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.action.findFirst({
      where: { publicSlug: input.slug, isPublic: true },
      select: { id: true, viewCount: true },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const existing = await prisma.actionView.findUnique({
      where: { actionId_fingerprint: { actionId: event.id, fingerprint: input.fingerprint } },
      select: { id: true },
    });

    if (existing) {
      return { viewCount: event.viewCount, wasNew: false };
    }

    const [, updated] = await prisma.$transaction([
      prisma.actionView.create({
        data: {
          actionId: event.id,
          fingerprint: input.fingerprint,
          userId: context.user?.id ?? null,
          referrer: input.referrer,
          sharerToken: input.sharerToken,
        },
      }),
      prisma.action.update({
        where: { id: event.id },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      }),
    ]);

    return { viewCount: updated.viewCount, wasNew: true };
  });
