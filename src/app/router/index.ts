import { leadRoutes } from "./leads";
import { statusRoutes } from "./status";
import { trackingRoutes } from "./trackings";
import { tagsRouter } from "./tags";
import { reasonsRouter } from "./reasons";
import { archiveLead } from "./leads/archive";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  leads: leadRoutes,
  tags: tagsRouter,
  reasons: reasonsRouter,
};
