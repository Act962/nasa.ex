import { getNerpCatalogIntegration } from "./get";
import { upsertNerpCatalogIntegration } from "./upsert";
import { applyDefaultCatalogStages } from "./apply-default-stages";

export const nerpCatalogIntegrationRouter = {
  get: getNerpCatalogIntegration,
  upsert: upsertNerpCatalogIntegration,
  applyDefaultStages: applyDefaultCatalogStages,
};
