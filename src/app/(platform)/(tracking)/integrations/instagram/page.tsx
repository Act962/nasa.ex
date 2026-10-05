import { Suspense } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InstagramAccountsPage } from "@/features/social-accounts/components/instagram-accounts-page";

export default function InstagramSatellitePage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">
        <Suspense>
          <InstagramAccountsPage />
        </Suspense>
      </div>
    </SidebarInset>
  );
}
