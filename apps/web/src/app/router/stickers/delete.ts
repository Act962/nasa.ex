import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Remove uma figurinha da org. Só o criador pode remover (`userId ===
 * context.user.id`). Owners/admins removem via UI admin futura.
 *
 * Não deleta o arquivo do R2 — fica órfão até cron de limpeza. Trade-off:
 * mais simples e seguro (delete de arquivo costuma falhar silenciosamente
 * em prod, deixando rastro confuso).
 */
export const deleteSticker = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/stickers/delete",
    summary: "Remove figurinha personalizada (apenas o criador)",
    tags: ["Stickers", "Tracking Chat"],
  })
  .input(
    z.object({
      stickerId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      deleted: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const sticker = await prisma.userSticker.findUnique({
      where: { id: input.stickerId },
      select: { id: true, userId: true, organizationId: true, label: true },
    });
    if (!sticker) {
      throw errors.NOT_FOUND({ message: "Figurinha não encontrada" });
    }
    if (sticker.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão pra essa figurinha" });
    }
    if (sticker.userId !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Só o criador pode remover essa figurinha",
      });
    }

    await prisma.userSticker.delete({ where: { id: sticker.id } });

    logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image ?? null,
      appSlug: "chat",
      subAppSlug: "tracking-chat",
      featureKey: "chat.sticker.deleted",
      action: "sticker.deleted",
      actionLabel: "Removeu figurinha personalizada",
      resource: "sticker",
      resourceId: sticker.id,
      metadata: { label: sticker.label },
    }).catch(() => {});

    return { deleted: true };
  });
