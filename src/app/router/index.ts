import { leadRoutes } from "./leads";
import { statusRoutes } from "./status";
import { trackingRoutes } from "./trackings";
import { tagsRouter } from "./tags";
import { reasonsRouter } from "./reasons";
import { archiveLead } from "./leads/archive";
import { orgRoutes } from "./org";
import { workflowRoutes } from "./workflow";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  leads: leadRoutes,
  tags: tagsRouter,
  reasons: reasonsRouter,
  orgs: orgRoutes,
  workflow: workflowRoutes,
};
