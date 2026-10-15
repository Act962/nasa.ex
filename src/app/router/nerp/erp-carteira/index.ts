import { getErpCarteiraStatus } from "./status";
import { startErpCarteiraImport } from "./start";
import { getLeadErpProfile } from "./lead-profile";

export const nerpErpCarteiraRouter = {
  status: getErpCarteiraStatus,
  start: startErpCarteiraImport,
  leadProfile: getLeadErpProfile,
};
