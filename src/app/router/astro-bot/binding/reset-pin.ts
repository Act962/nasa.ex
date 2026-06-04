import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { hashPin, isValidPin } from "@/features/astro-bot/lib/auth";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * User redefine próprio PIN sem precisar de OTP (já está autenticado
 * no NASA). Limpa lockout + sessão atual — força reauth no próximo cmd.
 */
export const resetBindingPin = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bindingId: z.string(),
      newPin: z.string().regex(/^\d{4,6}$/),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isValidPin(input.newPin)) {
      throw errors.BAD_REQUEST({ message: "PIN deve ter 4-6 dígitos" });
    }

    const binding = await prisma.userWhatsappBinding.findUnique({
      where: { id: input.bindingId },
      select: { id: true, userId: true, organizationId: true, phoneE164: true },
    });
    if (!binding || binding.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Binding não encontrado" });
    }
    // Só o dono pode redefinir o próprio PIN
    if (binding.userId !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "Só o dono do binding pode redefinir o PIN",
      });
    }

    const pinHash = await hashPin(input.newPin);
    await prisma.userWhatsappBinding.update({
      where: { id: binding.id },
      data: {
        pinHash,
        pinFailures: 0,
        pinLockedUntil: null,
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
      action: "astro_bot.pin_reset",
      actionLabel: `Redefiniu PIN do binding WhatsApp ${binding.phoneE164}`,
      resource: binding.phoneE164,
      resourceId: binding.id,
    });

    return { ok: true };
  });
