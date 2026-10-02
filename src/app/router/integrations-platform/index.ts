import { getManyPlatformIntegrations } from "./get-many";
import { upsertPlatformIntegration } from "./upsert";
import { deletePlatformIntegration } from "./delete";
import { getChannelOrbit } from "./get-channel-orbit";
import { organizationAiCreditsRouter } from "./ai-credits";

export const platformIntegrationsRouter = {
  getMany: getManyPlatformIntegrations,
  upsert: upsertPlatformIntegration,
  delete: deletePlatformIntegration,
  channelOrbit: getChannelOrbit,
  aiCredits: organizationAiCreditsRouter,
};
