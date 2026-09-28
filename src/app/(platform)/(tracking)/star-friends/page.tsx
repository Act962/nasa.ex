import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { StarFriendsPage } from "@/features/star-friends/components/star-friends-page";

export default function Page() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">
        <StarFriendsPage />
      </div>
    </SidebarInset>
  );
}
