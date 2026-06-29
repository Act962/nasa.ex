import { type ReactNode } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { SpaceHelpShell } from "@/features/space-help/components/space-help-shell";

export default function SpaceHelpLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarInset className="min-h-full bg-background">
      <HeaderTracking title="Space Help" />
      <SpaceHelpShell>{children}</SpaceHelpShell>
    </SidebarInset>
  );
}
