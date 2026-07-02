import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertOrgAdmin } from "../_require-admin";

/**
 * Revoga um número da allow-list: marca `isActive: false`. Comandos
 * subsequentes por esse número retornam "binding_inactive". Só owner/admin.
 */
export const revokeBinding = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ bindingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await assertOrgAdmin({
      organizationId: context.org.id,
      userId: context.user.id,
      errors,
    });

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
