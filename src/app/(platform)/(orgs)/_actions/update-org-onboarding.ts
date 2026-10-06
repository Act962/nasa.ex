"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { COMPANY_TYPE_SLUGS } from "@/features/company/constants";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const toUndefinedWhenBlank = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const orgOnboardingSchema = z.object({
  orgId: z.string().min(1),
  companyNiche: z.preprocess(
    toUndefinedWhenBlank,
    z.string().trim().max(120, "Nicho muito longo").optional(),
  ),
  companyCep: z.preprocess(
    toUndefinedWhenBlank,
    z
      .string()
      .trim()
      .regex(/^\d{5}-\d{3}$/, "CEP inválido")
      .optional(),
  ),
  companyType: z.preprocess(
    toUndefinedWhenBlank,
    z
      .string()
      .refine((companyType) => COMPANY_TYPE_SLUGS.includes(companyType), {
        message: "Tipo de empresa inválido",
      })
      .optional(),
  ),
});

export async function updateOrgOnboarding(
  orgId: string,
  data: { companyNiche?: string; companyCep?: string; companyType?: string },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Não autorizado");
  }

  const payload = orgOnboardingSchema.parse({ orgId, ...data });

  const ownerMembership = await prisma.member.findFirst({
    where: {
      organizationId: payload.orgId,
      userId: session.user.id,
      role: "owner",
    },
    select: { id: true },
  });
  if (!ownerMembership) {
    throw new Error("Você não tem permissão para alterar esta empresa");
  }

  // O tipo vem do cadastro e vale só para a primeira empresa do dono.
  const ownedOrganizationCount = await prisma.member.count({
    where: { userId: session.user.id, role: "owner" },
  });
  const isFirstOwnedOrganization = ownedOrganizationCount === 1;

  await prisma.organization.update({
    where: { id: payload.orgId },
    data: {
      companyNiche: payload.companyNiche,
      companyCep: payload.companyCep,
      companyType: isFirstOwnedOrganization ? payload.companyType : undefined,
    },
  });
}
