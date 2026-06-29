import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Cria uma figurinha (UserSticker) na organização atual.
 *
 * Pressupõe que o arquivo já foi carregado pro R2 — o caller passa apenas
 * a URL final + mimetype. Reusa o mesmo Uploader que já é usado pra
 * imagens do composer.
 *
 * Não faz dedup automático (mesma URL pode ser cadastrada 2x) — a UI
 * decide se quer impedir uploads duplicados antes de chamar.
 */
export const createSticker = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/stickers/create",
    summary: "Cria figurinha personalizada",
    tags: ["Stickers", "Tracking Chat"],
  })
  .input(
    z.object({
      url: z.string().url(),
      mimetype: z.string().min(1).default("image/webp"),
      label: z.string().nullable().optional(),
    }),
  )
  .output(
    z.object({
      sticker: z.object({
        id: z.string(),
        url: z.string(),
        mimetype: z.string(),
        label: z.string().nullable(),
        createdAt: z.date(),
      }),
    }),
  )
  .handler(async ({ input, context }) => {
    const sticker = await prisma.userSticker.create({
      data: {
        organizationId: context.org.id,
        userId: context.user.id,
        url: input.url,
        mimetype: input.mimetype,
        label: input.label ?? null,
      },
      select: {
        id: true,
        url: true,
        mimetype: true,
        label: true,
        createdAt: true,
      },
    });

    logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image ?? null,
      appSlug: "chat",
      subAppSlug: "tracking-chat",
      featureKey: "chat.sticker.created",
      action: "sticker.created",
      actionLabel: "Adicionou figurinha personalizada",
      resource: "sticker",
      resourceId: sticker.id,
      metadata: { mimetype: input.mimetype, label: input.label },
    }).catch(() => {});

    return { sticker };
  });
