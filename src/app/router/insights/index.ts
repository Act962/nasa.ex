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

export const insightsRouter = {
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
};
