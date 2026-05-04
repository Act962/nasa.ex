import { getAppsInsights } from "./get-apps-insights";
import { generateReport } from "./generate-report";
import { getLeadCountByTracking } from "./get-lead-count-by-tracking";
import { getLeadsByAcquisitionChannel } from "./get-leads-by-acquisition-channel";
import { getLeadsByAttendant } from "./get-leads-by-attendant";
import { getLeadsByTags } from "./get-leads-by-tags";
import { getSoldThisMonth } from "./get-sold-this-month";
import { getTrackingDashboardReport } from "./get-tracking-dashboard-report";
import { getWonLeads } from "./get-won-leads";
import { createShareInsights } from "./create-share-insights";
import { listInsightShares } from "./list-insight-shares";
import { publicOrganizationDashboard } from "./public-organization-dashboard";
import { deleteInsight } from "./delete-insight";
import { listLeadsAtInsights } from "./list-leads-at-insight";
import { listMyOrganizations } from "./list-my-organizations";
import { getActivitySummary } from "./get-activity-summary";
import { getActivityNow } from "./get-activity-now";
import { saveReport } from "./saved-reports/save-report";
import { listSavedReports } from "./saved-reports/list-saved-reports";
import { getSavedReport } from "./saved-reports/get-saved-report";
import { deleteSavedReport } from "./saved-reports/delete-saved-report";
import { getOrgLayout } from "./layout/get-org-layout";
import { saveOrgLayout } from "./layout/save-org-layout";
import { getAppMetric } from "./layout/get-app-metric";
import { getPinnedBlocksForApp } from "./layout/get-pinned-blocks-for-app";
import { getCrossInsights } from "./cross/get-cross-insights";
import { generateTileNarrative } from "./cross/generate-tile-narrative";
import { getWorkspacesReport } from "./reports/get-workspaces-report";
import { getTrackingsReport } from "./reports/get-trackings-report";
import { getAttendantsReport } from "./reports/get-attendants-report";
import { getMemberActivityReport } from "./reports/get-member-activity-report";

export const insightsRouter = {
  getAppsInsights,
  generateReport,
  getTrackingDashboardReport,
  getLeadsByAcquisitionChannel,
  getLeadCountByTracking,
  getLeadsByAttendant,
  getLeadsByTags,
  getSoldThisMonth,
  getWonLeads,
  createShareInsights,
  listInsightShares,
  publicOrganizationDashboard,
  deleteInsight,
  listLeadsAtInsights,
  listMyOrganizations,
  getActivitySummary,
  getActivityNow,
  saveReport,
  listSavedReports,
  getSavedReport,
  deleteSavedReport,
  getOrgLayout,
  saveOrgLayout,
  getAppMetric,
  getPinnedBlocksForApp,
  getCrossInsights,
  generateTileNarrative,
  getWorkspacesReport,
  getTrackingsReport,
  getAttendantsReport,
  getMemberActivityReport,
};
