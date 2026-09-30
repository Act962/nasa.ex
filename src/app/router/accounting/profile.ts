import { z } from "zod";
import prisma from "@/lib/prisma";
import { getOrCreateTaxProfile } from "@/features/accounting/server/profile/tax-profile";
import { syncFiscalObligations } from "@/features/accounting/server/obligations/sync-fiscal-obligations";
import { inngest } from "@/inngest/client";
import { accountingReadProcedure, accountingWriteProcedure } from "./procedures";

const regimeSchema = z.enum(["MEI", "SIMPLES", "PRESUMIDO", "REAL"]);

const profileShape = z.object({
  id: z.string(),
  regime: regimeSchema,
  cnaePrincipal: z.string().nullable(),
  cnaesSecundarios: z.array(z.string()),
  simplesAnnex: z.string().nullable(),
  isFatorRSubject: z.boolean(),
  stateRegistration: z.string().nullable(),
  municipalRegistration: z.string().nullable(),
  municipioIbge: z.string().nullable(),
  uf: z.string().nullable(),
  openedAt: z.date().nullable(),
  payroll12mCents: z.number(),
  hasEmployees: z.boolean(),
  isIcmsContributor: z.boolean(),
  isIssContributor: z.boolean(),
  presumedIrpjBaseBps: z.number(),
  presumedCsllBaseBps: z.number(),
  issRateBps: z.number().nullable(),
  ibsCbsOutsideSimples: z.boolean(),
  alertPhones: z.array(z.string()),
  onboardingCompletedAt: z.date().nullable(),
  organizationCnpj: z.string().nullable(),
});

export const getAccountingProfile = accountingReadProcedure
  .route({ method: "GET", summary: "Perfil fiscal da empresa", tags: ["Accounting"] })
  .input(z.object({}).optional())
  .output(profileShape)
  .handler(async ({ context }) => {
    const profile = await getOrCreateTaxProfile(context.org.id);
    const organization = await prisma.organization.findUnique({
      where: { id: context.org.id },
      select: { cnpj: true },
    });
    return { ...profile, organizationCnpj: organization?.cnpj ?? null };
  });

export const updateAccountingProfile = accountingWriteProcedure
  .route({ method: "PATCH", summary: "Atualiza o perfil fiscal", tags: ["Accounting"] })
  .input(
    z.object({
      regime: regimeSchema.optional(),
      cnaePrincipal: z.string().max(10).nullable().optional(),
      cnaesSecundarios: z.array(z.string().max(10)).max(50).optional(),
      simplesAnnex: z.string().max(20).nullable().optional(),
      isFatorRSubject: z.boolean().optional(),
      stateRegistration: z.string().max(30).nullable().optional(),
      municipalRegistration: z.string().max(30).nullable().optional(),
      municipioIbge: z.string().regex(/^\d{7}$/).nullable().optional(),
      uf: z.string().length(2).nullable().optional(),
      openedAt: z.string().nullable().optional(),
      payroll12mCents: z.number().int().min(0).optional(),
      hasEmployees: z.boolean().optional(),
      isIcmsContributor: z.boolean().optional(),
      isIssContributor: z.boolean().optional(),
      presumedIrpjBaseBps: z.number().int().min(0).max(10000).optional(),
      presumedCsllBaseBps: z.number().int().min(0).max(10000).optional(),
      issRateBps: z.number().int().min(0).max(1000).nullable().optional(),
      ibsCbsOutsideSimples: z.boolean().optional(),
      alertPhones: z.array(z.string().max(20)).max(10).optional(),
      completeOnboarding: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const current = await getOrCreateTaxProfile(context.org.id);
    const { openedAt, completeOnboarding, ...fields } = input;
    const isFirstCompletion = Boolean(completeOnboarding) && !current.onboardingCompletedAt;

    await prisma.organizationTaxProfile.update({
      where: { organizationId: context.org.id },
      data: {
        ...fields,
        ...(openedAt !== undefined ? { openedAt: openedAt ? new Date(`${openedAt.slice(0, 10)}T12:00:00Z`) : null } : {}),
        ...(isFirstCompletion ? { onboardingCompletedAt: new Date() } : {}),
      },
    });

    await syncFiscalObligations(context.org.id);
    if (isFirstCompletion) {
      // Primeira ativação: gera a contabilidade de todo o histórico do financeiro.
      try {
        await inngest.send({ name: "accounting/journal.backfill", data: { organizationId: context.org.id } });
      } catch (error) {
        console.error("[accounting/profile] backfill não enfileirado:", error);
      }
    }
    return { ok: true as const };
  });
