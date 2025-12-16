import { listTrackings } from "./list-trackings";
import { getTracking } from "./get";
import { updateTracking } from "./update";
import { deleteTracking } from "./delete";
import { createTracking } from "./create";
import { addParticipant } from "./add-participant";
import { removeParticipant } from "./remove-participant";
import { listParticipants } from "./list-participants";

export const trackingRoutes = {
  list: listTrackings,
  create: createTracking,
  get: getTracking,
  update: updateTracking,
  delete: deleteTracking,
  addParticipant: addParticipant,
  removeParticipant: removeParticipant,
  listParticipants: listParticipants,
};
