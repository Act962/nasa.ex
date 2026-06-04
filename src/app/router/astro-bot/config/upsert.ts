import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Cria/atualiza a config do Astro Bot da org. Idempotente.
 *
 * Só owner pode chamar (validado via middleware adicional na index do
 * router quando o bot Suite/Cloud entrar). Pra Earth uazapi, todos os
 * admins podem configurar pra acelerar.
 */
export const upsertBotConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      provider: z.enum(["UAZAPI", "META_CLOUD"]).default("UAZAPI"),
      uazapiInstanceId: z.string().nullable().optional(),
      metaPhoneId: z.string().nullable().optional(),
      metaAccessToken: z.string().nullable().optional(),
      metaWabaId: z.string().nullable().optional(),
      maxPhonesPerOrg: z.number().int().min(1).max(50).default(3),
      maxCmdsPerHour: z.number().int().min(1).max(500).default(30),
      quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
      quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
      isActive: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Valida instância UAZAPI escolhida (se for UAZAPI tier)
    if (input.provider === "UAZAPI" && input.uazapiInstanceId) {
      const inst = await prisma.whatsAppInstance.findUnique({
        where: { id: input.uazapiInstanceId },
        select: { organizationId: true },
      });
      if (!inst || inst.organizationId !== context.org.id) {
        throw errors.BAD_REQUEST({
          message: "Instância WhatsApp inválida ou de outra organização",
        });
      }
    }

    const existing = await prisma.organizationBotConfig.findUnique({
      where: { organizationId: context.org.id },
    });
    const wasActive = existing?.isActive ?? false;

    const config = await prisma.organizationBotConfig.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        provider: input.provider,
        uazapiInstanceId: input.uazapiInstanceId ?? null,
        metaPhoneId: input.metaPhoneId ?? null,
        metaAccessToken: input.metaAccessToken ?? null,
        metaWabaId: input.metaWabaId ?? null,
        maxPhonesPerOrg: input.maxPhonesPerOrg,
        maxCmdsPerHour: input.maxCmdsPerHour,
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        isActive: input.isActive,
      },
      update: {
        provider: input.provider,
        uazapiInstanceId: input.uazapiInstanceId ?? null,
        metaPhoneId: input.metaPhoneId ?? null,
        metaAccessToken: input.metaAccessToken ?? null,
        metaWabaId: input.metaWabaId ?? null,
        maxPhonesPerOrg: input.maxPhonesPerOrg,
        maxCmdsPerHour: input.maxCmdsPerHour,
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        isActive: input.isActive,
      },
    });

    if (wasActive !== input.isActive) {
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: input.isActive
          ? "astro_bot.config_activated"
          : "astro_bot.config_deactivated",
        actionLabel: input.isActive
          ? "Ativou Astro Bot WhatsApp pra org"
          : "Desativou Astro Bot WhatsApp da org",
        resource: "Astro Bot WhatsApp",
        resourceId: config.id,
        metadata: {
          provider: input.provider,
          maxCmdsPerHour: input.maxCmdsPerHour,
        },
      });
    }

    return { config };
  });
