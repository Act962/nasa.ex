import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertOrgAdmin } from "../_require-admin";

/**
 * Adiciona um número à allow-list do Astro (Insights pelo WhatsApp) e o
 * mapeia a um membro da org. Sem OTP/PIN: o fluxo confia no número
 * allow-listado pelo admin. O `userId` define em nome de quem o Astro roda
 * (permissões/escopo de dados).
 *
 * Reativa em vez de duplicar quando o número já existe na MESMA org (o
 * `phoneE164` é unique global).
 */
export const createBinding = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      phoneE164: z.string().regex(/^\d{10,15}$/, "Telefone em formato E.164 (só dígitos)"),
      userId: z.string().min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await assertOrgAdmin({
      organizationId: context.org.id,
      userId: context.user.id,
      errors,
    });

    const config = await prisma.organizationBotConfig.findUnique({
      where: { organizationId: context.org.id },
      select: { id: true },
    });
    if (!config) {
      throw errors.BAD_REQUEST({
        message: "Configure o Astro pelo WhatsApp antes de adicionar números.",
      });
    }

    // O membro precisa pertencer à org — é em nome dele que o Astro consulta.
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: input.userId },
      select: { id: true },
    });
    if (!member) {
      throw errors.BAD_REQUEST({
        message: "O usuário escolhido não faz parte desta organização.",
      });
    }

    const existing = await prisma.userWhatsappBinding.findUnique({
      where: { phoneE164: input.phoneE164 },
      select: { id: true, organizationId: true },
    });
    if (existing && existing.organizationId !== context.org.id) {
      throw errors.BAD_REQUEST({
        message: "Este número já está vinculado em outra organização.",
      });
    }

    const binding = existing
      ? await prisma.userWhatsappBinding.update({
          where: { id: existing.id },
          data: {
            userId: input.userId,
            organizationBotConfigId: config.id,
            isActive: true,
            verifiedAt: new Date(),
          },
        })
      : await prisma.userWhatsappBinding.create({
          data: {
            userId: input.userId,
            organizationId: context.org.id,
            organizationBotConfigId: config.id,
            phoneE164: input.phoneE164,
            verifiedAt: new Date(),
            allowedTools: ["search", "lists", "analytics", "charts"],
            isActive: true,
          },
        });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as { image?: string }).image,
      appSlug: "tracking",
      action: "astro_bot.binding_created",
      actionLabel: `Adicionou WhatsApp ${input.phoneE164} à allow-list do Astro`,
      resource: input.phoneE164,
      resourceId: binding.id,
      metadata: { targetUserId: input.userId },
    });

    return { bindingId: binding.id, phoneE164: binding.phoneE164 };
  });
