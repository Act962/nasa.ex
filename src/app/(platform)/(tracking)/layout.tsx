import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./_components/sidebar";
import { HeaderTracking } from "./_components/header-tracking";
import { currentOrganization, requireAuth } from "@/lib/auth-utils";
import { EmptyOrganization } from "./_components/empty-organization";

export default async function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  const org = await currentOrganization();

  return (
    <SidebarProvider>
      <AppSidebar />

      {org && <>{children}</>}
      {!org && (
        <SidebarInset>
          <div className="h-full flex items-center justify-center">
            <EmptyOrganization />
          </div>
        </SidebarInset>
      )}
    </SidebarProvider>
  );
}
