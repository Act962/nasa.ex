"use server";

import prisma from "@/lib/prisma";

export async function updateOrgOnboarding(
  orgId: string,
  data: { companyNiche?: string; companyCep?: string },
) {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      companyNiche: data.companyNiche,
      companyCep: data.companyCep,
    },
  });
}
