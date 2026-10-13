"use client";

import { useQueryPlatformIntegrations, type IntegrationPlatform } from "@/features/integrations/hooks/use-integrations";

const NETWORK_TO_PLATFORM: Record<string, IntegrationPlatform> = {
  INSTAGRAM: "INSTAGRAM",
  FACEBOOK: "META",
  TIKTOK: "TIKTOK",
  LINKEDIN: "LINKEDIN",
};

export function useNetworkConnectionStatus() {
  const { data } = useQueryPlatformIntegrations();
  const integrations = data?.integrations ?? [];

  const connectedPlatforms = new Set(
    integrations.filter((integration) => integration.isActive).map((integration) => integration.platform),
  );

  return {
    isConnected: (network: string): boolean => {
      const platform = NETWORK_TO_PLATFORM[network];
      return platform ? connectedPlatforms.has(platform) : false;
    },
  };
}
