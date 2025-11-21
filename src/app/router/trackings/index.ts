import { listTrackings } from "./list-trackings";
import { getTracking } from "./get";
import { updateTracking } from "./update";
import { deleteTracking } from "./delete";
import { createTracking } from "./create";

export const trackingRoutes = {
  list: listTrackings,
  create: createTracking,
  get: getTracking,
  update: updateTracking,
  delete: deleteTracking,
};
