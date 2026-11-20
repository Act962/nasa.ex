import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { AccountExplorerView } from "@/features/trafego/components/panel/account-explorer/account-explorer-view";

export default function TrafegoAccountPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <HeaderTracking title="trafeGO" isTitleHidden />
      <div className="flex-1 overflow-auto">
        <AccountExplorerView />
      </div>
    </SidebarInset>
  );
}
