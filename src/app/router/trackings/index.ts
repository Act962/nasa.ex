import { listTrackings } from "./list-trackings";
import { getTracking } from "./get";
import { updateTracking } from "./update";
import { deleteTracking } from "./delete";
import { createTracking } from "./create";
import { addParticipant } from "./add-participant";
import { removeParticipant } from "./remove-participant";
import { listParticipants } from "./list-participants";
import { listAllTrackings } from "./list-all-trackings";
import { getTrackingCardConfig } from "./get-card-config";
import { updateTrackingCardConfig } from "./update-card-config";
import { listDashboard } from "./list-dashboard";
import { getCardAppearance } from "./get-card-appearance";
import { getTrackingIdleAutomation } from "./get-idle-automation";
import { updateTrackingIdleAutomation } from "./update-idle-automation";

export const trackingRoutes = {
  list: listTrackings,
  listDashboard,
  getCardAppearance,
  create: createTracking,
  get: getTracking,
  update: updateTracking,
  delete: deleteTracking,
  addParticipant: addParticipant,
  removeParticipant: removeParticipant,
  listParticipants: listParticipants,
  listAllTrackings,
  getCardConfig: getTrackingCardConfig,
  updateCardConfig: updateTrackingCardConfig,
  getIdleAutomation: getTrackingIdleAutomation,
  updateIdleAutomation: updateTrackingIdleAutomation,
};
