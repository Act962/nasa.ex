import { leadRoutes } from "./leads";
import { statusRoutes } from "./status";
import { trackingRoutes } from "./trackings";
import { tagsRouter } from "./tags";
import { tagGroupsRouter } from "./tag-groups";
import { reasonsRouter } from "./reasons";
import { orgRoutes } from "./org";
import { workflowRoutes } from "./workflow";
import { workflowFolderRoutes } from "./workflow-folder";
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
import { adminRouter } from "./admin";
import { userNotificationsRouter } from "./user-notifications";
import { userChatPreferencesRoutes } from "./user-chat-preferences";
import { alertsRouter } from "./alerts";
import { sidebarPrefsRouter } from "./sidebar-prefs";
import { spacePointRouter } from "./space-point";
import { userRouter } from "./user";
import { publicRouter } from "./public";
import { paymentRouter } from "./payment";
import { orgProjectsRouter } from "./org-projects";
import { clientPortalRouter } from "./client-portal";
import { supportRouter } from "./support";
import { scriptsRouter } from "./scripts";
import { linnkerRouter } from "./linnker";
import { spaceStationRouter } from "./space-station";
import { worldEventsRouter } from "./world-events";
import { companySpaceRouter } from "./company-space";
import { profileCardRouter } from "./profile-card";
import { spaceHelpRouter } from "./space-help";
import { nasaRouteRouter } from "./nasa-route";
import { pagesRouter } from "./pages";
import { inviteLinksRouter } from "./invite-links";
import { workspaceWorkflowRoutes } from "./workspace-workflow";
import { reminderRouter } from "./reminder";
import { partnerRouter } from "./partner";
import { metaAdsRouter } from "./meta-ads";
import { metaMcpRouter } from "./meta-mcp";
import { astroRoutes } from "@/features/astro/server/routes";
import { nerpRouter } from "./nerp";
import { commentsRouter } from "./comments";
import { livekitRouter } from "./livekit";
import { stickersRouter } from "./stickers";
import { brandRouter } from "./brand";
import { trackingPresetsRouter } from "./tracking-presets";
import { agentsRouter } from "./agents";
import { inChatRouter } from "./in-chat";
import { workflowClipboardRouter } from "./workflow-clipboard";
import { astroBotRouter } from "./astro-bot";
import { fiscalRouter } from "./fiscal";

export const router = {
  tracking: trackingRoutes,
  status: statusRoutes,
  column: columnRoutes,
  leads: leadRoutes,
  tags: tagsRouter,
  tagGroups: tagGroupsRouter,
  trackingPresets: trackingPresetsRouter,
  agents: agentsRouter,
  /** Astro Bot via WhatsApp — config + binding por user. */
  astroBot: astroBotRouter,
  reasons: reasonsRouter,
  orgs: orgRoutes,
  workflow: workflowRoutes,
  workflowFolder: workflowFolderRoutes,
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
  userChatPreferences: userChatPreferencesRoutes,
  alerts: alertsRouter,
  sidebarPrefs: sidebarPrefsRouter,
  spacePoint: spacePointRouter,
  user: userRouter,
  public: publicRouter,
  payment: paymentRouter,
  orgProjects: orgProjectsRouter,
  clientPortal: clientPortalRouter,
  support: supportRouter,
  scripts: scriptsRouter,
  linnker: linnkerRouter,
  spaceStation: spaceStationRouter,
  worldEvents: worldEventsRouter,
  companySpace: companySpaceRouter,
  profileCard: profileCardRouter,
  spaceHelp: spaceHelpRouter,
  nasaRoute: nasaRouteRouter,
  pages: pagesRouter,
  inviteLinks: inviteLinksRouter,
  workspaceWorkflow: workspaceWorkflowRoutes,
  reminder: reminderRouter,
  partner: partnerRouter,
  metaAds: metaAdsRouter,
  metaMcp: metaMcpRouter,
  astro: astroRoutes,
  nerp: nerpRouter,
  commentsApp: commentsRouter,
  livekit: livekitRouter,
  stickers: stickersRouter,
  brand: brandRouter,
  inChat: inChatRouter,
  /** Copy/paste/export/import de workflows entre trackings/orgs. */
  workflowClipboard: workflowClipboardRouter,
  fiscal: fiscalRouter,
};
