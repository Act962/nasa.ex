import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { parseStatusColumnMap } from "@/features/trafego/lib/kanban-columns";
import {
  invalidateTrafegoSettingsCache,
  loadTrafegoSettings,
} from "@/features/trafego/server/lib/trafego-settings";
import { provisionTrafegoOperationsTracking } from "@/features/trafego/server/lib/provision-operations-tracking";
import { provisionTrafegoBriefingForm } from "@/features/trafego/server/lib/provision-briefing-form";

const SINGLETON_ID = "singleton";

const nullableId = z.string().min(1).nullable();

export const getTrafegoSettings = base
  .use(requireAdminMiddleware)
  .input(z.object({}).optional())
  .handler(async () => {
    const settings = await prisma.trafegoSettings.findUnique({
      where: { id: SINGLETON_ID },
    });

    if (!settings) {
      return {
        id: SINGLETON_ID,
        agencyOrganizationId: null,
        defaultBroadcastTrackingId: null,
        salesTrackingId: null,
        salesStatusId: null,
        defaultServiceFeePercent: 50,
        supportWhatsapp: null,
        operationsTrackingId: null,
        statusColumnMap: {},
        briefingFormId: null,
        partnerBusinessId: null,
        whatsappActivationTemplate: null,
        whatsappStatusTemplate: null,
        whatsappOtpTemplate: null,
        whatsappTemplateLanguage: "pt_BR",
        pixKey: null,
        pixHolderName: null,
        pixBankName: null,
        pixExpiryHours: 48,
        clientNotificationsEnabled: true,
        financeAccountId: null,
        financeRevenueCategoryId: null,
        financePassthroughCategoryId: null,
        updatedAt: null,
        updatedById: null,
      };
    }

    return {
      ...settings,
      defaultServiceFeePercent: Number(settings.defaultServiceFeePercent),
      statusColumnMap: parseStatusColumnMap(settings.statusColumnMap),
    };
  });

export const updateTrafegoSettings = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      agencyOrganizationId: nullableId,
      defaultBroadcastTrackingId: nullableId,
      salesTrackingId: nullableId,
      salesStatusId: nullableId,
      defaultServiceFeePercent: z.number().min(0).max(1000),
      supportWhatsapp: z.string().trim().max(30).nullable(),
      operationsTrackingId: nullableId,
      statusColumnMap: z.record(z.string(), z.string()).optional(),
      briefingFormId: nullableId,
      partnerBusinessId: z.string().trim().max(40).nullable(),
      whatsappActivationTemplate: z.string().trim().max(120).nullable(),
      whatsappStatusTemplate: z.string().trim().max(120).nullable(),
      whatsappOtpTemplate: z.string().trim().max(120).nullable(),
      pixKey: z.string().trim().max(140).nullable(),
      pixHolderName: z.string().trim().max(120).nullable(),
      pixBankName: z.string().trim().max(80).nullable(),
      pixExpiryHours: z.number().int().min(1).max(720),
      whatsappTemplateLanguage: z.string().trim().min(2).max(10),
      clientNotificationsEnabled: z.boolean(),
      financeAccountId: nullableId,
      financeRevenueCategoryId: nullableId,
      financePassthroughCategoryId: nullableId,
    }),
  )
  .handler(async ({ input, context }) => {
    const agencyOrganizationId = input.agencyOrganizationId;

    // Conta e categorias precisam ser da org da agência — é nela que a venda
    // é lançada. Um id de outra org geraria lançamento em lugar errado.
    if (agencyOrganizationId) {
      if (input.operationsTrackingId) {
        await assertBelongsToOrg(
          prisma.tracking.count({
            where: { id: input.operationsTrackingId, organizationId: agencyOrganizationId },
          }),
          "O tracking de operação não pertence à organização da agência.",
        );
      }
      if (input.financeAccountId) {
        await assertBelongsToOrg(
          prisma.paymentBankAccount.count({
            where: { id: input.financeAccountId, organizationId: agencyOrganizationId },
          }),
          "A conta financeira não pertence à organização da agência.",
        );
      }
      if (input.financeRevenueCategoryId) {
        await assertBelongsToOrg(
          prisma.paymentCategory.count({
            where: {
              id: input.financeRevenueCategoryId,
              organizationId: agencyOrganizationId,
              type: "REVENUE",
            },
          }),
          "A categoria de receita precisa ser do tipo Receita e da org da agência.",
        );
      }
      if (input.financePassthroughCategoryId) {
        await assertBelongsToOrg(
          prisma.paymentCategory.count({
            where: {
              id: input.financePassthroughCategoryId,
              organizationId: agencyOrganizationId,
              type: { in: ["EXPENSE", "COST"] },
            },
          }),
          "A categoria de repasse precisa ser Despesa ou Custo e da org da agência.",
        );
      }
      if (input.briefingFormId) {
        await assertBelongsToOrg(
          prisma.form.count({
            where: { id: input.briefingFormId, organizationId: agencyOrganizationId },
          }),
          "O formulário de briefing não pertence à organização da agência.",
        );
      }
    }

    const statusColumnMap = parseStatusColumnMap(input.statusColumnMap ?? {});
    const data = { ...input, statusColumnMap, updatedById: context.adminUser.id };

    await prisma.trafegoSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
    invalidateTrafegoSettingsCache();
    return { success: true };
  });

async function assertBelongsToOrg(countPromise: Promise<number>, message: string) {
  if ((await countPromise) === 0) {
    throw new ORPCError("BAD_REQUEST", { message });
  }
}

/**
 * Opções para os selects da tela de ajustes — trackings (com colunas), contas,
 * categorias e formulários da org da agência. Admin-scoped de propósito: as
 * procedures de `payment.*` exigem sessão dentro da org.
 */
export const listTrafegoAgencyOptions = base
  .use(requireAdminMiddleware)
  .input(z.object({ organizationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const [trackings, accounts, categories, forms] = await Promise.all([
      prisma.tracking.findMany({
        where: { organizationId: input.organizationId, isArchived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          status: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, color: true },
          },
        },
      }),
      prisma.paymentBankAccount.findMany({
        where: { organizationId: input.organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.paymentCategory.findMany({
        where: { organizationId: input.organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true },
      }),
      prisma.form.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, published: true },
      }),
    ]);

    return { trackings, accounts, categories, forms };
  });

async function resolveAgencyOrganizationId(explicit?: string | null): Promise<string> {
  if (explicit) return explicit;
  const settings = await loadTrafegoSettings({ fresh: true });
  if (!settings.agencyOrganizationId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Configure a organização da agência antes de provisionar.",
    });
  }
  return settings.agencyOrganizationId;
}

/** Cria/completa o tracking "TrafeGO" e preenche o mapa status → coluna. */
export const provisionTrafegoOperationsTrackingProcedure = base
  .use(requireAdminMiddleware)
  .input(
    z
      .object({
        organizationId: z.string().min(1).optional(),
        trackingName: z.string().trim().min(1).max(60).optional(),
      })
      .optional(),
  )
  .handler(async ({ input, context }) => {
    const organizationId = await resolveAgencyOrganizationId(input?.organizationId);
    return provisionTrafegoOperationsTracking({
      organizationId,
      actorUserId: context.adminUser.id,
      trackingName: input?.trackingName,
    });
  });

/** Cria o formulário "Briefing TrafeGO" na org da agência. */
export const provisionTrafegoBriefingFormProcedure = base
  .use(requireAdminMiddleware)
  .input(z.object({ organizationId: z.string().min(1).optional() }).optional())
  .handler(async ({ input, context }) => {
    const organizationId = await resolveAgencyOrganizationId(input?.organizationId);
    return provisionTrafegoBriefingForm({ organizationId, actorUserId: context.adminUser.id });
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
