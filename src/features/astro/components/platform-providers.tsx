"use client";

import { type ReactNode } from "react";
import { MarketplaceProvider } from "@/features/integrations/context/marketplace-context";
import { AstroAgent } from "./astro-agent";
import { HeartbeatProvider } from "@/components/heartbeat-provider";
import { SpacePointProvider } from "@/features/space-point";
import { TourProvider } from "@/features/tour/context";
import { TourOverlay } from "@/features/tour/overlay";
import { useGlobalShortcuts } from "@/features/admin/components/shortcuts-client";

function GlobalShortcutsRegistrar() {
  useGlobalShortcuts();
  return null;
}

export function PlatformProviders({ children }: { children: ReactNode }) {
  return (
    <TourProvider>
      <MarketplaceProvider>
        <SpacePointProvider>
          {children}
          <GlobalShortcutsRegistrar />
          <AstroAgent />
          <TourOverlay />
          <HeartbeatProvider />
        </SpacePointProvider>
      </MarketplaceProvider>
    </TourProvider>
  );
}
