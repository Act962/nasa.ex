import { leadRoutes } from "./leads";
import { statusRoutes } from "./status";
import { trackingRoutes } from "./trackings";
import { tagsRouter } from "./tags";
import { reasonsRouter } from "./reasons";
import { orgRoutes } from "./org";
import { workflowRoutes } from "./workflow";
import { messageRouter } from "./message";
import { conversationRouter } from "./conversation";
import { integrationsRouter } from "./integrations";
import { iaRouter } from "./ia";
import { insightsRouter } from "./insights";
import { agendaRouter } from "./agenda";
import { rodizioRouter } from "./rodizio";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  leads: leadRoutes,
  tags: tagsRouter,
  reasons: reasonsRouter,
  orgs: orgRoutes,
  workflow: workflowRoutes,
  message: messageRouter,
  conversation: conversationRouter,
  integrations: integrationsRouter,
  ia: iaRouter,
  insights: insightsRouter,
  agenda: agendaRouter,
  rodizio: rodizioRouter,
};
