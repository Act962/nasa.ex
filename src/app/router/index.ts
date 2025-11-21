import { leadRoutes } from "./leads";
import { statusRoutes } from "./status";
import { trackingRoutes } from "./trackings";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  leads: leadRoutes,
};
