import { listNerpCatalogSettings } from "./list";
import { updateNerpCatalogSettings } from "./update";

export const nerpCatalogSettingsRouter = {
  list: listNerpCatalogSettings,
  update: updateNerpCatalogSettings,
};
