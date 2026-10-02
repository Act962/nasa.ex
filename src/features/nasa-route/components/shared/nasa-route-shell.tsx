"use client";

import type { ReactNode } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { NASA_ROUTE_COMMAND_EXAMPLES } from "../../lib/command-examples";

/** Moldura das telas logadas do ÓRBITA Route: barra de cima sem título (a página mostra o próprio). */
export function NasaRouteShell({ children }: { children: ReactNode }) {
  return (
    <SidebarInset className="min-w-0 overflow-x-hidden">
      <HeaderTracking
        title="ÓRBITA Route"
        isTitleHidden
        astroCommand={{ examples: NASA_ROUTE_COMMAND_EXAMPLES, isHiddenOnMobile: true }}
      />
      {children}
    </SidebarInset>
  );
}
