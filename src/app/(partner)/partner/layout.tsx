import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import { PartnerLayoutClient } from "@/features/partner/components/partner-layout-client";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, partner } = await requirePartnerSession({
    skipTermsCheck: true,
  });

  return (
    <PartnerLayoutClient
      partnerUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      }}
      tier={partner.tier ?? null}
    >
      {children}
    </PartnerLayoutClient>
  );
}
