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
import { nasaPlannerRouter } from "./nasa-planner";
import { nasaCommandRouter } from "./nasa-command";
import { permissionsRouter } from "./permissions";
import { activityRouter } from "./activity";
import { formRouter } from "./form";
import { adminRouter }              from "./admin";
import { userNotificationsRouter }  from "./user-notifications";
import { sidebarPrefsRouter }       from "./sidebar-prefs";
import { spacePointRouter }          from "./space-point";
import { userRouter }                from "./user";
import { publicRouter }              from "./public";
import { plansRouter }               from "./plans";
import { paymentRouter }             from "./payment";
import { orgProjectsRouter }         from "./org-projects";
import { clientPortalRouter }        from "./client-portal";
import { supportRouter } from "./support";
import { scriptsRouter } from "./scripts";

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
  nasaPlanner: nasaPlannerRouter,
  nasaCommand: nasaCommandRouter,
  permissions: permissionsRouter,
  activity: activityRouter,
  form: formRouter,
  admin: adminRouter,
  userNotifications: userNotificationsRouter,
  sidebarPrefs: sidebarPrefsRouter,
  spacePoint: spacePointRouter,
  user:       userRouter,
  public:     publicRouter,
  plans:      plansRouter,
  payment:    paymentRouter,
  orgProjects: orgProjectsRouter,
  clientPortal: clientPortalRouter,
  support: supportRouter,
  scripts: scriptsRouter,
};
