"use client";

import { type ReactNode } from "react";
import { MarketplaceProvider } from "@/features/integrations/context/marketplace-context";
// AstroAgent (widget flutuante legado) substituído pelo AstroOrb. Mantemos
// o componente no codebase pra referência mas não é mais montado.
// import { AstroAgent } from "./astro-agent";
import { AstroProvider } from "./astro-provider";
import { HeartbeatProvider } from "@/components/heartbeat-provider";
import { SpacePointProvider } from "@/features/space-point";
import { AlertProvider } from "@/features/alerts/components/alert-provider";
import { AstroOrb } from "@/features/astro/voice/astro-orb";
import { CmdkPalette } from "@/features/astro/composer/cmdk-palette";
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
            <AlertProvider>
              <AstroProvider>
                {children}
                <TourOverlay />
                <HeartbeatProvider />
              </AstroProvider>
            </AlertProvider>
          </SpacePointProvider>
        </MarketplaceProvider>
      </TourProvider>
    );
  }

  return (
    <TourProvider>
      <MarketplaceProvider>
        <SpacePointProvider>
          <AlertProvider>
            <AstroProvider>
              {children}
              <GlobalShortcutsRegistrar />
              <AstroOrb />
              <CmdkPalette />
              <ConnectionWizardDialog />
              <TourOverlay />
              <HeartbeatProvider />
            </AstroProvider>
          </AlertProvider>
        </SpacePointProvider>
      </MarketplaceProvider>
    </TourProvider>
  );
}
