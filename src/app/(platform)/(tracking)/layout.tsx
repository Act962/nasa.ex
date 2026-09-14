import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../../../components/sidebar";
import { HeaderTracking } from "../../../features/leads/components/header-tracking";
import { currentOrganization } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { TrafegoScopeGuard } from "@/features/trafego/components/trafego-scope-guard";
import { EmptyOrganization } from "../../../features/leads/components/empty-organization";
import { cookies } from "next/headers";
import { PlatformProviders } from "@/features/astro/components/platform-providers";
import { UploadManagerDock } from "@/features/nasa-route/components/upload-manager-dock";

export default async function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "open";
  const org = await currentOrganization();

  // `getFullOrganization` do better-auth não expõe campos customizados sem
  // registrá-los em `additionalFields` — daí a leitura direta.
  const scopedOrg = org
    ? await prisma.organization.findUnique({
        where: { id: org.id },
        select: { appScope: true },
      })
    : null;

  return (
    <PlatformProviders>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />

        <TrafegoScopeGuard appScope={scopedOrg?.appScope ?? null} />

        {org && <>{children}</>}
        {!org && (
          <SidebarInset>
            <HeaderTracking />
            <div className="h-full flex items-center justify-center">
              <EmptyOrganization />
            </div>
          </SidebarInset>
        )}

        <UploadManagerDock />
      </SidebarProvider>
    </PlatformProviders>
  );
}
