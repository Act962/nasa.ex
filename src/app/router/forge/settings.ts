import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { isOrgOwnerOrAdmin } from "@/features/permissions/server/is-org-admin";
import { normalizePaymentMethods, normalizeProposalSections, proposalLookInputSchema } from "@/features/forge/lib/proposal-look";

/** Mesmo conteúdo com as chaves em outra ordem conta como igual. */
function toStableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toStableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>).sort(([first], [second]) => first.localeCompare(second));
    return `{${fields.map(([key, fieldValue]) => `${JSON.stringify(key)}:${toStableJson(fieldValue)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const settingsShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  commissionPercentage: z.string(),
  letterheadHeader: z.string().nullable(),
  letterheadFooter: z.string().nullable(),
  letterheadHeaderImage: z.string().nullable(),
  letterheadFooterImage: z.string().nullable(),
  logoUrl: z.string().nullable(),
  proposalBgColor: z.string(),
  proposalBgImage: z.string().nullable(),
  typographyColor: z.string(),
  securityLevel: z.string(),
  reminderDaysBefore: z.number(),
  paymentGatewayConfigs: z.any(),
  proposalTemplate: z.string(),
  brandColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  proposalSections: z.array(z.object({ id: z.string(), enabled: z.boolean() })),
  paymentMethods: z.array(z.object({ method: z.string(), installments: z.number().nullable().optional(), note: z.string().nullable().optional() })),
  commercialTerms: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const getForgeSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get forge settings", tags: ["Forge"] })
  .input(z.object({}))
  .output(z.object({ settings: settingsShape }))
  .handler(async ({ context, errors }) => {
    try {
      let settings = await prisma.forgeSettings.findUnique({
        where: { organizationId: context.org.id },
      });
      if (!settings) {
        settings = await prisma.forgeSettings.create({
          data: { organizationId: context.org.id },
        });
      }
      return {
        settings: {
          ...settings,
          commissionPercentage: settings.commissionPercentage.toString(),
          proposalSections: normalizeProposalSections(settings.proposalSections),
          paymentMethods: normalizePaymentMethods(settings.paymentMethods),
        },
      };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updateForgeSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update forge settings", tags: ["Forge"] })
  .input(
    z.object({
      commissionPercentage: z.string().optional(),
      letterheadHeader: z.string().nullable().optional(),
      letterheadFooter: z.string().nullable().optional(),
      letterheadHeaderImage: z.string().nullable().optional(),
      letterheadFooterImage: z.string().nullable().optional(),
      logoUrl: z.string().nullable().optional(),
      proposalBgColor: z.string().optional(),
      proposalBgImage: z.string().nullable().optional(),
      typographyColor: z.string().optional(),
      securityLevel: z.enum(["PUBLICO", "PRIVADO", "TWO_FA"]).optional(),
      reminderDaysBefore: z.number().optional(),
      paymentGatewayConfigs: z.any().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    // Chave PIX e credenciais de gateway decidem para onde vai o dinheiro do cliente: só dono e
    // administrador alteram. A tela reenvia o bloco inteiro a cada gravação, então só barra se mudou.
    if (input.paymentGatewayConfigs !== undefined && !(await isOrgOwnerOrAdmin(context.org.id, context.user.id))) {
      const current = await prisma.forgeSettings.findUnique({
        where: { organizationId: context.org.id },
        select: { paymentGatewayConfigs: true },
      });
      if (toStableJson(current?.paymentGatewayConfigs ?? {}) !== toStableJson(input.paymentGatewayConfigs ?? {})) {
        throw errors.FORBIDDEN({ message: "Só o dono ou um administrador da empresa altera os dados de pagamento." });
      }
    }
    try {
      const data = {
        commissionPercentage: input.commissionPercentage,
        letterheadHeader: input.letterheadHeader,
        letterheadFooter: input.letterheadFooter,
        letterheadHeaderImage: input.letterheadHeaderImage,
        letterheadFooterImage: input.letterheadFooterImage,
        logoUrl: input.logoUrl,
        proposalBgColor: input.proposalBgColor,
        proposalBgImage: input.proposalBgImage,
        typographyColor: input.typographyColor,
        securityLevel: input.securityLevel as never,
        reminderDaysBefore: input.reminderDaysBefore,
        paymentGatewayConfigs: input.paymentGatewayConfigs,
      };
      await prisma.forgeSettings.upsert({
        where: { organizationId: context.org.id },
        update: data,
        create: {
          organizationId: context.org.id,
          commissionPercentage: input.commissionPercentage ?? "0",
          proposalBgColor: input.proposalBgColor ?? "#ffffff",
          typographyColor: input.typographyColor ?? "#111111",
          securityLevel: (input.securityLevel ?? "PUBLICO") as never,
          reminderDaysBefore: input.reminderDaysBefore ?? 3,
          paymentGatewayConfigs: input.paymentGatewayConfigs ?? {},
        },
      });
      return { ok: true };
    } catch (err) {
      console.error("[forge/settings update]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

/** Visual da proposta pública (spec 0150): modelo, cores, ordem das seções, formas de pagamento e condições. */
export const updateForgeProposalLook = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update the public proposal look", tags: ["Forge"] })
  .input(proposalLookInputSchema)
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    const data = {
      proposalTemplate: input.proposalTemplate,
      brandColor: input.brandColor?.toLowerCase() ?? null,
      accentColor: input.accentColor?.toLowerCase() ?? null,
      proposalSections: normalizeProposalSections(input.proposalSections) as unknown as Prisma.InputJsonValue,
      paymentMethods: normalizePaymentMethods(input.paymentMethods) as unknown as Prisma.InputJsonValue,
      commercialTerms: input.commercialTerms || null,
    };
    await prisma.forgeSettings.upsert({
      where: { organizationId: context.org.id },
      update: data,
      create: { organizationId: context.org.id, ...data },
    });
    return { ok: true };
  });
