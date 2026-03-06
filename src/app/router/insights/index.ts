import { getLeadCountByTracking } from "./get-lead-count-by-tracking";
import { getLeadsByAcquisitionChannel } from "./get-leads-by-acquisition-channel";
import { getLeadsByAttendant } from "./get-leads-by-attendant";
import { getLeadsByTags } from "./get-leads-by-tags";
import { getSoldThisMonth } from "./get-sold-this-month";
import { getTrackingDashboardReport } from "./get-tracking-dashboard-report";
import { getWonLeads } from "./get-won-leads";

export const insightsRouter = {
  getTrackingDashboardReport,
  getLeadsByAcquisitionChannel,
  getLeadCountByTracking,
  getLeadsByAttendant,
  getLeadsByTags,
  getSoldThisMonth,
  getWonLeads,
};
