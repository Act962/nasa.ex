"use client";

import { type ReactNode } from "react";
import { MarketplaceProvider } from "@/features/integrations/context/marketplace-context";
import { AstroAgent } from "./astro-agent";

export function PlatformProviders({ children }: { children: ReactNode }) {
  return (
    <MarketplaceProvider>
      {children}
      <AstroAgent />
    </MarketplaceProvider>
  );
}
