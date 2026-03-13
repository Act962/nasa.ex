import { SidebarInset } from "@/components/ui/sidebar";
import { UserInfo } from "@/features/settings/components/user-info";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { TabsList } from "@/features/settings/components/tabs-list";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking title="Configurações" />
      <div className="h-full mt-4 space-y-6">
        <UserInfo />
        <TabsList />
        <main className="w-full max-w-7xl mx-auto">{children}</main>
      </div>
    </SidebarInset>
  );
}
