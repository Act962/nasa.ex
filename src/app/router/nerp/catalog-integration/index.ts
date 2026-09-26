import { getNerpCatalogIntegration } from "./get";
import { upsertNerpCatalogIntegration } from "./upsert";

export const nerpCatalogIntegrationRouter = {
  get: getNerpCatalogIntegration,
  upsert: upsertNerpCatalogIntegration,
};
