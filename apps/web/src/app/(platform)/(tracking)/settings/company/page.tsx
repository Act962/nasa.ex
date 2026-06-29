import { CompanySettingsClient } from "@/features/settings/components/company/company-settings-client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export default async function CompanySettings() {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  const orgDetails = organization?.id
    ? await prisma.organization.findUnique({
        where: { id: organization.id },
        select: {
          companyNiche: true,
          companyCep: true,
          brandIcp: true,
          brandSwot: true,
        },
      })
    : null;

  return (
    <div className="py-4 px-5">
      <CompanySettingsClient
        company={{
          id: organization?.id!,
          name: organization?.name!,
          logo: organization?.logo ?? undefined,
          companyNiche: orgDetails?.companyNiche ?? "",
          companyCep: orgDetails?.companyCep ?? "",
          brandIcp: orgDetails?.brandIcp ?? "",
          brandSwot: (orgDetails?.brandSwot as Record<string, string>) ?? {},
        }}
      />
    </div>
  );
}
