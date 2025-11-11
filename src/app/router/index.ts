import { createStatus, listStatus } from "./status";
import {
  createTracking,
  getTracking,
  listTrackings,
  updateTracking,
  deleteTracking,
} from "./trackings";

export const router = {
  tracking: {
    list: listTrackings,
    create: createTracking,
    get: getTracking,
    update: updateTracking,
    delete: deleteTracking,
  },
  status: {
    list: listStatus,
    create: createStatus,
    // get: {},
    // update: {},
    // delete: {},
  },
};
