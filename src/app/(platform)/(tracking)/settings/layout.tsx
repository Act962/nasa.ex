import { Suspense } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { SettingsShell } from "@/features/settings/components/shell/settings-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking title="Configurações" isTitleHidden />
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <OrbitaSpinner className="size-6 text-muted-foreground" />
          </div>
        }
      >
        <SettingsShell>{children}</SettingsShell>
      </Suspense>
    </SidebarInset>
  );
}
