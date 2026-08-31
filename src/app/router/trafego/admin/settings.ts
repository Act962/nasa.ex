import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { z } from "zod";

const SINGLETON_ID = "singleton";

export const getTrafegoSettings = base
  .use(requireAdminMiddleware)
  .input(z.object({}).optional())
  .handler(async () => {
    const settings = await prisma.trafegoSettings.findUnique({
      where: { id: SINGLETON_ID },
    });

    return settings
      ? { ...settings, defaultServiceFeePercent: Number(settings.defaultServiceFeePercent) }
      : {
          id: SINGLETON_ID,
          agencyOrganizationId: null,
          defaultBroadcastTrackingId: null,
          salesTrackingId: null,
          salesStatusId: null,
          defaultServiceFeePercent: 50,
          supportWhatsapp: null,
          updatedAt: null,
          updatedById: null,
        };
  });

export const updateTrafegoSettings = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      agencyOrganizationId: z.string().min(1).nullable(),
      defaultBroadcastTrackingId: z.string().min(1).nullable(),
      salesTrackingId: z.string().min(1).nullable(),
      salesStatusId: z.string().min(1).nullable(),
      defaultServiceFeePercent: z.number().min(0).max(1000),
      supportWhatsapp: z.string().trim().max(30).nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    await prisma.trafegoSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...input, updatedById: context.adminUser.id },
      update: { ...input, updatedById: context.adminUser.id },
    });
    return { success: true };
  });

/**
 * Alterna o escopo de produto de uma organização. Zerar `appScope` promove um
 * cliente trafeGO a conta completa da plataforma.
 */
export const setOrganizationAppScope = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      organizationId: z.string().min(1),
      appScope: z.enum(["trafego"]).nullable(),
    }),
  )
  .handler(async ({ input }) => {
    await prisma.organization.update({
      where: { id: input.organizationId },
      data: { appScope: input.appScope },
    });
    return { success: true };
  });
