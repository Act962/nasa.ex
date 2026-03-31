"use client";

import { type ReactNode } from "react";
import { MarketplaceProvider } from "@/features/integrations/context/marketplace-context";
import { AstroAgent } from "./astro-agent";
import { HeartbeatProvider } from "@/components/heartbeat-provider";

export function PlatformProviders({ children }: { children: ReactNode }) {
  return (
    <MarketplaceProvider>
      {children}
      <AstroAgent />
      <HeartbeatProvider />
    </MarketplaceProvider>
  );
}
