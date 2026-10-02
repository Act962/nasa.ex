import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { StarFriendsPage } from "@/features/star-friends/components/star-friends-page";

export default function Page() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking title="STAR FRIENDS" isTitleHidden />
      <div className="px-4 pt-2 pb-8 md:px-6">
        <StarFriendsPage />
      </div>
    </SidebarInset>
  );
}
