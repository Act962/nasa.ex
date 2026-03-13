import { FormCompany } from "@/features/settings/components/form-compnay";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function CompanySettings() {
  const organization = await auth.api.getFullOrganization({
    headers: await headers(),
  });

  return (
    <div className="py-4 px-5">
      <FormCompany
        company={{
          id: organization?.id!,
          name: organization?.name!,
          logo: organization?.logo!,
        }}
      />
    </div>
  );
}
