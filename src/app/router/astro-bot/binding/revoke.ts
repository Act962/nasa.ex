import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Revoga binding: marca `isActive: false` + apaga sessão. Comandos
 * subsequentes pelo phone retornam "binding_inactive" no Astro Bot.
 *
 * Permissões: user pode revogar próprios; admin pode revogar de qualquer
 * membro da org. Middleware de role TODO — MVP confia que UI só expõe
 * "Revogar de outros" pra admin.
 */
export const revokeBinding = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ bindingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const binding = await prisma.userWhatsappBinding.findUnique({
      where: { id: input.bindingId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        phoneE164: true,
      },
    });
    if (!binding || binding.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Binding não encontrado" });
    }

    await prisma.userWhatsappBinding.update({
      where: { id: binding.id },
      data: {
        isActive: false,
        sessionToken: null,
        sessionExpiresAt: null,
        sessionDeviceId: null,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      action: "astro_bot.binding_revoked",
      actionLabel:
        binding.userId === context.user.id
          ? `Revogou próprio binding WhatsApp ${binding.phoneE164}`
          : `Revogou binding WhatsApp ${binding.phoneE164} de outro membro`,
      resource: binding.phoneE164,
      resourceId: binding.id,
      metadata: {
        targetUserId: binding.userId,
        revokedBySelf: binding.userId === context.user.id,
      },
    });

    return { ok: true };
  });
