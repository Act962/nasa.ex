import { connectInstanceUazapi } from "./conect";
import { createInstanceUazapi } from "./create";
import { deleteInstanceUazapi } from "./delet";
import { disconnectInstanceUazapi } from "./disconect";
import { getIntegration } from "./list";
import { newNasaIntegration } from "./new-nasa-total";
import { newNasaIntegrationPartial } from "./new-nasa-partial";
import { setupMetaIntegration, getMetaIntegration } from "./setup-meta";
import { listAvailableInstances } from "./list-available";
import { oauthFinalize } from "./oauth-finalize";
import { disconnectOAuth } from "./disconnect-oauth";
import { getConnectionStatus } from "./get-connection-status";
import { listAvailableMetaAccounts } from "./list-meta-accounts";
import { getActiveMetaSelection } from "./get-active-meta";
import { setActiveMetaAccount } from "./set-active-meta";
import { listMembersWithMetaAccess } from "./list-members-meta-access";
import { setMemberMetaAccess } from "./set-member-meta-access";

export const integrationsRouter = {
  create: createInstanceUazapi,
  connect: connectInstanceUazapi,
  disconnect: disconnectInstanceUazapi,
  get: getIntegration,
  delete: deleteInstanceUazapi,
  newNasa: newNasaIntegration,
  newNasaPartial: newNasaIntegrationPartial,
  setupMeta: setupMetaIntegration,
  getMeta: getMetaIntegration,
  listAvailable: listAvailableInstances,
  oauthFinalize,
  disconnectOAuth,
  getConnectionStatus,
  listAvailableMetaAccounts,
  getActiveMetaSelection,
  setActiveMetaAccount,
  listMembersWithMetaAccess,
  setMemberMetaAccess,
};
