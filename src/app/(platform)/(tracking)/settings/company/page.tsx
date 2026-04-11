import { CompanySettingsClient } from "@/features/settings/components/company/company-settings-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function CompanySettings() {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  return (
    <div className="py-4 px-5">
      <CompanySettingsClient
        company={{
          id: organization?.id!,
          name: organization?.name!,
          logo: organization?.logo ?? undefined,
        }}
      />
    </div>
  );
}
