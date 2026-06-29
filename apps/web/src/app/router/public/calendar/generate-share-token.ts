import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { customAlphabet } from "nanoid";

const tokenGen = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 10);

export const generateShareToken = base
  .use(optionalAuthMiddleware)
  .input(
    z.object({
      slug: z.string().min(1),
      platform: z.enum(["whatsapp", "x", "facebook", "linkedin", "copy", "google", "ics"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.action.findFirst({
      where: { publicSlug: input.slug, isPublic: true },
      select: { id: true, publicSlug: true },
    });
    if (!event) throw errors.NOT_FOUND({ message: "Evento não encontrado" });

    const sharerToken = tokenGen();

    const [share] = await prisma.$transaction([
      prisma.publicActionShare.create({
        data: {
          actionId: event.id,
          sharerUserId: context.user?.id ?? null,
          sharerToken,
          platform: input.platform,
        },
      }),
      prisma.action.update({
        where: { id: event.id },
        data: { shareCount: { increment: 1 } },
        select: { shareCount: true },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const eventUrl = `${appUrl}/calendario/evento/${event.publicSlug}?s=${sharerToken}`;
    const shortUrl = `${appUrl}/api/calendario/track-share?s=${sharerToken}`;

    return { sharerToken: share.sharerToken, eventUrl, shortUrl };
  });
