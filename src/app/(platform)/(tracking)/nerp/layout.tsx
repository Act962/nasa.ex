import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function NerpLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("nerp");
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">{children}</div>
    </SidebarInset>
  );
}
