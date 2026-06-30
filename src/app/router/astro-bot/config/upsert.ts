import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertOrgAdmin } from "../_require-admin";

/**
 * Cria/atualiza a config do Astro pelo WhatsApp (Insights). Idempotente.
 *
 * O Astro responde pelo número da própria tracking (provider ativo dela), então
 * a config guarda apenas: quais trackings estão habilitadas + limites + janela
 * de silêncio + toggle de ativação. Só owner/admin pode chamar.
 */
export const upsertBotConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      enabledTrackingIds: z.array(z.string()).default([]),
      maxCmdsPerHour: z.number().int().min(1).max(500).default(30),
      quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
      quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
      isActive: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await assertOrgAdmin({
      organizationId: context.org.id,
      userId: context.user.id,
      errors,
    });

    // Valida que todas as trackings escolhidas são da org.
    if (input.enabledTrackingIds.length > 0) {
      const owned = await prisma.tracking.count({
        where: {
          id: { in: input.enabledTrackingIds },
          organizationId: context.org.id,
        },
      });
      if (owned !== input.enabledTrackingIds.length) {
        throw errors.BAD_REQUEST({
          message: "Uma ou mais trackings são inválidas ou de outra org",
        });
      }
    }

    const existing = await prisma.organizationBotConfig.findUnique({
      where: { organizationId: context.org.id },
      select: { id: true, isActive: true },
    });
    const wasActive = existing?.isActive ?? false;

    const config = await prisma.$transaction(async (tx) => {
      const saved = await tx.organizationBotConfig.upsert({
        where: { organizationId: context.org.id },
        create: {
          organizationId: context.org.id,
          maxCmdsPerHour: input.maxCmdsPerHour,
          quietHoursStart: input.quietHoursStart ?? null,
          quietHoursEnd: input.quietHoursEnd ?? null,
          isActive: input.isActive,
        },
        update: {
          maxCmdsPerHour: input.maxCmdsPerHour,
          quietHoursStart: input.quietHoursStart ?? null,
          quietHoursEnd: input.quietHoursEnd ?? null,
          isActive: input.isActive,
        },
      });

      // Substitui a seleção de trackings habilitadas (replace-all).
      await tx.astroBotTracking.deleteMany({
        where: { botConfigId: saved.id },
      });
      if (input.enabledTrackingIds.length > 0) {
        await tx.astroBotTracking.createMany({
          data: input.enabledTrackingIds.map((trackingId) => ({
            botConfigId: saved.id,
            trackingId,
          })),
          skipDuplicates: true,
        });
      }

      return saved;
    });

    if (wasActive !== input.isActive) {
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string }).image,
        appSlug: "tracking",
        action: input.isActive
          ? "astro_bot.config_activated"
          : "astro_bot.config_deactivated",
        actionLabel: input.isActive
          ? "Ativou Astro pelo WhatsApp pra org"
          : "Desativou Astro pelo WhatsApp da org",
        resource: "Astro pelo WhatsApp",
        resourceId: config.id,
        metadata: {
          enabledTrackings: input.enabledTrackingIds.length,
          maxCmdsPerHour: input.maxCmdsPerHour,
        },
      });
    }

    return { config };
  });
