import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../../../components/sidebar";
import { HeaderTracking } from "../../../features/leads/components/header-tracking";
import { currentOrganization } from "@/lib/auth-utils";
import { EmptyOrganization } from "../../../features/leads/components/empty-organization";
import { cookies } from "next/headers";

export default async function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "open";
  const org = await currentOrganization();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />

      {org && <>{children}</>}
      {!org && (
        <SidebarInset>
          <HeaderTracking />
          <div className="h-full flex items-center justify-center">
            <EmptyOrganization />
          </div>
        </SidebarInset>
      )}
    </SidebarProvider>
  );
}
