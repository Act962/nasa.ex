import { createStation } from "./create-station";
import { updateStation } from "./update-station";
import { getStationByNick } from "./get-by-nick";
import { listStations } from "./list-stations";
import { sendStar } from "./send-star";
import { updateWorld } from "./update-world";
import { getWorld } from "./get-world";
import { getOrgChart } from "./get-org-chart";
import { updatePublicModules } from "./update-modules";
import { getMyStation } from "./get-my-station";
import { listWorldAssets, createWorldAsset, updateWorldAsset, deleteWorldAsset } from "./world-assets";
import { listWorldTemplates } from "./list-world-templates";
import { listMyWorldTemplates } from "./list-my-world-templates";
import { getWorldTemplate } from "./get-world-template";
import { deleteWorldTemplate } from "./delete-world-template";
import { publishWorldTemplate } from "./publish-world-template";
import { applyWorldTemplate } from "./apply-world-template";
// ── Procedures usadas pelos componentes modulares (restauradas) ──
import { listMyStations } from "./list-my-stations";
import { listOrgStationsWithLocation } from "./list-org-stations-with-location";
import { checkStationAccess } from "./check-station-access";
import { requestStationAccess } from "./request-station-access";
import { listAccessRequests } from "./list-access-requests";
import { handleAccessRequest } from "./handle-access-request";
import { updateStationAccessMode } from "./update-station-access-mode";
import { updateOrgLocation } from "./update-org-location";
import { getOrgSettings } from "./get-org-settings";
import { getBubblePeersStatus } from "./get-bubble-peers-status";
import { resolvePeerAsLead } from "./resolve-peer-as-lead";
import { publishAvatarTemplate } from "./publish-avatar-template";
import { listAvatarTemplates } from "./list-avatar-templates";
import { createUserConnection } from "./create-user-connection";
import { listMyConnections } from "./list-my-connections";
import { joinWorld } from "./join-world";
import { sendStationMessage } from "./send-station-message";
import { listStationMessages } from "./list-station-messages";
import { pokePeer } from "./poke-peer";

export const spaceStationRouter = {
  create: createStation,
  update: updateStation,
  getByNick: getStationByNick,
  list: listStations,
  sendStar,
  updateWorld,
  getWorld,
  getOrgChart,
  updateModules: updatePublicModules,
  getMy: getMyStation,
  listWorldAssets,
  createWorldAsset,
  updateWorldAsset,
  deleteWorldAsset,
  listWorldTemplates,
  listMyWorldTemplates,
  getWorldTemplate,
  deleteWorldTemplate,
  publishWorldTemplate,
  applyWorldTemplate,
  // ── Aliases e procedures novas (usadas pelo editor + bubbles) ──
  listMy: listMyStations,
  listEmpresasMap: listOrgStationsWithLocation,
  checkAccess: checkStationAccess,
  requestAccess: requestStationAccess,
  listAccessRequests,
  handleAccessRequest,
  updateAccessMode: updateStationAccessMode,
  updateOrgLocation,
  getOrgSettings,
  getBubblePeersStatus,
  resolvePeerAsLead,
  publishAvatarTemplate,
  listAvatarTemplates,
  createUserConnection,
  listMyConnections,
  joinWorld,
  sendStationMessage,
  listStationMessages,
  pokePeer,
};
