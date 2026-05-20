import { getInsightsDrilldown } from "./insights-drilldown";
import * as campaigns from "./campaigns";
import { syncSnapshots, listSnapshots } from "./snapshots";
import { executeMcpAction, cancelMcpAction } from "./execute-mcp-action";
import { getTopAds } from "./get-top-ads";
import {
  getInsightsBreakdown,
  getInsightsTimeSeries,
} from "./breakdowns";
import { getInstagramOverview } from "./instagram";
import { getFacebookOverview } from "./facebook";

export const metaAdsRouter = {
  insightsDrilldown: getInsightsDrilldown,
  insightsBreakdown: getInsightsBreakdown,
  insightsTimeSeries: getInsightsTimeSeries,
  instagramOverview: getInstagramOverview,
  facebookOverview: getFacebookOverview,
  campaigns: {
    list: campaigns.list,
    create: campaigns.create,
    update: campaigns.update,
    delete: campaigns.remove,
  },
  snapshots: {
    sync: syncSnapshots,
    list: listSnapshots,
  },
  executeMcpAction,
  cancelMcpAction,
  getTopAds,
};
