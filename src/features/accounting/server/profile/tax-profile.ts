import "server-only";

import prisma from "@/lib/prisma";
import type { OrganizationTaxProfile } from "@/generated/prisma/client";
import type { EffectiveRateProfile } from "@/features/accounting/lib/pricing/compute-effective-rate";
import type { ApplicabilityProfile } from "@/features/accounting/lib/compliance/document-catalog";

/** Perfil fiscal da org; nasce com defaults (Simples, Anexo III) no primeiro acesso. */
export async function getOrCreateTaxProfile(organizationId: string): Promise<OrganizationTaxProfile> {
  const existing = await prisma.organizationTaxProfile.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.organizationTaxProfile.upsert({
    where: { organizationId },
    create: { organizationId, regime: "SIMPLES", simplesAnnex: "III", uf: "PI", municipioIbge: "2211001", issRateBps: 500 },
    update: {},
  });
}

export function toEffectiveRateProfile(profile: OrganizationTaxProfile): EffectiveRateProfile {
  return {
    regime: profile.regime,
    simplesAnnex: profile.simplesAnnex,
    isFatorRSubject: profile.isFatorRSubject,
    payroll12mCents: profile.payroll12mCents,
    presumedIrpjBaseBps: profile.presumedIrpjBaseBps,
    presumedCsllBaseBps: profile.presumedCsllBaseBps,
    issRateBps: profile.issRateBps,
    ibsCbsOutsideSimples: profile.ibsCbsOutsideSimples,
  };
}

export function toApplicabilityProfile(profile: OrganizationTaxProfile): ApplicabilityProfile {
  return {
    regime: profile.regime,
    hasEmployees: profile.hasEmployees,
    isIcmsContributor: profile.isIcmsContributor,
    isIssContributor: profile.isIssContributor,
  };
}
