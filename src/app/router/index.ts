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
import { widgetsRouter } from "./widgets";
import { workspaceRoutes } from "@/features/workspace/server/routes";
import { actionRoutes } from "@/features/actions/server/routes";

import { columnRoutes } from "./column";
import { platformIntegrationsRouter } from "./integrations-platform";
import { channelInsightsRouter } from "./channel-insights";
import { forgeRouter } from "./forge";
import { starsRouter } from "./stars";
import { nboxRouter } from "./nbox";
import { nasaPostRouter } from "./nasa-post";
import { nasaCommandRouter } from "./nasa-command";
import { permissionsRouter } from "./permissions";
import { formRouter } from "./form";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  column: columnRoutes,
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
  widgets: widgetsRouter,
  workspace: workspaceRoutes,
  action: actionRoutes,
  platformIntegrations: platformIntegrationsRouter,
  channelInsights: channelInsightsRouter,
  forge: forgeRouter,
  stars: starsRouter,
  nbox: nboxRouter,
  nasaPost: nasaPostRouter,
  nasaCommand: nasaCommandRouter,
  permissions: permissionsRouter,
  form: formRouter,
};
