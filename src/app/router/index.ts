import {
  addLeadFirst,
  addLeadLast,
  createLead,
  deleteLead,
  getLead,
  updateLead,
  updateLeadOrder,
} from "./leads";
import {
  createStatus,
  listStatus,
  updateStatus,
  updateStatusOrder,
} from "./status";
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
    update: updateStatus,
    // delete: {},
    updateOrder: updateStatusOrder,
  },
  leads: {
    create: createLead,
    get: getLead,
    update: updateLead,
    delete: deleteLead,
    addToFirst: addLeadFirst,
    addToLast: addLeadLast,
    updateOrder: updateLeadOrder,
  },
};
