import { createTracking, listTrackings } from "./tracking";

export const router = {
  tracking: {
    list: listTrackings,
    create: createTracking,
  },
};
