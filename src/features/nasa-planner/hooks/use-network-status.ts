"use client";

import { useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";

const NETWORK_TO_PLATFORM: Record<string, string> = {
  INSTAGRAM: "INSTAGRAM",
  FACEBOOK: "META",
  TIKTOK: "TIKTOK",
  LINKEDIN: "LINKEDIN",
};

export function useNetworkConnectionStatus() {
  const { data } = useQueryPlatformIntegrations();
  const integrations = data?.integrations ?? [];

  const connectedPlatforms = new Set(
    integrations.filter((i) => i.isActive).map((i) => i.platform),
  );

  return {
    isConnected: (network: string): boolean => {
      const platform = NETWORK_TO_PLATFORM[network];
      return platform ? connectedPlatforms.has(platform as any) : false;
    },
  };
}
