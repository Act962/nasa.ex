"use client";

import { type ReactNode } from "react";
import { MarketplaceProvider } from "@/features/integrations/context/marketplace-context";
import { AstroAgent } from "./astro-agent";
import { AstroProvider } from "./astro-provider";
import { HeartbeatProvider } from "@/components/heartbeat-provider";
import { SpacePointProvider } from "@/features/space-point";
import { TourProvider } from "@/features/tour/context";
import { TourOverlay } from "@/features/tour/overlay";
import { useGlobalShortcuts } from "@/features/admin/components/shortcuts-client";
import { ConnectionWizardDialog } from "@/features/integrations/components/connection-wizard/connection-wizard-dialog";

function GlobalShortcutsRegistrar() {
  useGlobalShortcuts();
  return null;
}

import { usePathname, useParams } from "next/navigation";

export function PlatformProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();

  const isTrackingChatPage =
    pathname.includes("tracking-chat") && params.conversationId;

  if (isTrackingChatPage) {
    return (
      <TourProvider>
        <MarketplaceProvider>
          <SpacePointProvider>
            <AstroProvider>
              {children}
              <TourOverlay />
              <HeartbeatProvider />
            </AstroProvider>
          </SpacePointProvider>
        </MarketplaceProvider>
      </TourProvider>
    );
  }

  return (
    <TourProvider>
      <MarketplaceProvider>
        <SpacePointProvider>
          <AstroProvider>
            {children}
            <GlobalShortcutsRegistrar />
            <AstroAgent />
            <ConnectionWizardDialog />
            <TourOverlay />
            <HeartbeatProvider />
          </AstroProvider>
        </SpacePointProvider>
      </MarketplaceProvider>
    </TourProvider>
  );
}
