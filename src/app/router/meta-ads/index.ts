import { getInsightsDrilldown } from "./insights-drilldown";
import * as campaigns from "./campaigns";
import { syncSnapshots, listSnapshots } from "./snapshots";

export const metaAdsRouter = {
  insightsDrilldown: getInsightsDrilldown,
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
};
