import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { hashPin, isValidPin } from "@/features/astro-bot/lib/auth";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Verifica OTP enviado por email + define PIN inicial + cria o binding.
 *
 * Por que PIN aqui (e não num passo separado): consolida o setup em 1
 * dialog, evita estados parciais ("verifiquei o OTP mas esqueci de
 * definir PIN") que sumiriam pelos 10min de TTL.
 */
export const verifyBindingOtp = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      phoneE164: z.string().regex(/^\d{10,15}$/),
      otp: z.string().regex(/^\d{6}$/, "OTP deve ter 6 dígitos"),
      pin: z
        .string()
        .regex(/^\d{4,6}$/, "PIN deve ter 4-6 dígitos"),
      /**
       * Whitelist de tools que esse binding pode executar. Default:
       * só read-only (search, lists, analytics). Owner expande depois
       * pra cada binding via `update-binding-permissions`.
       */
      allowedTools: z
        .array(z.string())
        .default(["search", "lists", "analytics", "charts"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isValidPin(input.pin)) {
      throw errors.BAD_REQUEST({ message: "PIN deve ter 4-6 dígitos" });
    }

    const config = await prisma.organizationBotConfig.findUnique({
      where: { organizationId: context.org.id },
      select: { id: true, isActive: true },
    });
    if (!config) {
      throw errors.BAD_REQUEST({
        message: "Astro Bot não configurado nesta org",
      });
    }

    const identifier = `astro-bot-otp:${context.user.id}:${input.phoneE164}`;
    const verification = await prisma.verification.findFirst({
      where: { identifier, value: input.otp },
      orderBy: { createdAt: "desc" },
    });
    if (!verification) {
      throw errors.BAD_REQUEST({
        message: "Código incorreto. Confira no email ou peça novo código.",
      });
    }
    if (verification.expiresAt.getTime() < Date.now()) {
      await prisma.verification.delete({ where: { id: verification.id } });
      throw errors.BAD_REQUEST({
        message: "Código expirou. Peça um novo.",
      });
    }

    // Tudo OK — cria binding.
    const pinHash = await hashPin(input.pin);

    const binding = await prisma.userWhatsappBinding.create({
      data: {
        userId: context.user.id,
        organizationId: context.org.id,
        organizationBotConfigId: config.id,
        phoneE164: input.phoneE164,
        verifiedAt: new Date(),
        pinHash,
        allowedTools: input.allowedTools,
        isActive: true,
      },
    });

    // Limpa o OTP usado + qualquer outro pendente desse (user, phone)
    await prisma.verification.deleteMany({ where: { identifier } });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      action: "astro_bot.binding_created",
      actionLabel: `Vinculou WhatsApp ${input.phoneE164} ao Astro Bot`,
      resource: input.phoneE164,
      resourceId: binding.id,
      metadata: { allowedTools: input.allowedTools },
    });

    return {
      bindingId: binding.id,
      phoneE164: binding.phoneE164,
    };
  });
