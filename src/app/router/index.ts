import { leadRoutes } from "./leads";
import { statusRoutes } from "./status";
import { trackingRoutes } from "./trackings";
import { tagsRouter } from "./tags";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  leads: leadRoutes,
  tags: tagsRouter,
};
