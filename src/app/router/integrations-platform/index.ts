import { getManyPlatformIntegrations } from "./get-many";
import { upsertPlatformIntegration } from "./upsert";
import { deletePlatformIntegration } from "./delete";

export const platformIntegrationsRouter = {
  getMany: getManyPlatformIntegrations,
  upsert: upsertPlatformIntegration,
  delete: deletePlatformIntegration,
};
