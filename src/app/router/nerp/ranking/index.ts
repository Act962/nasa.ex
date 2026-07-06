import { listSalesGoalRanking } from "./list";
import { listSalesGoalPeriods } from "./list-periods";
import { importSalesGoalRanking } from "./import";
import { upsertSalesGoalEntry } from "./upsert-entry";
import { deleteSalesGoalEntry } from "./delete-entry";
import { updateSalesGoalBranch } from "./update-branch";
import { listSalesGoalEvolution } from "./evolution";
import { getSalesGoalRankingSettings } from "./settings/get";
import { updateSalesGoalRankingSettings } from "./settings/update";

export const nerpRankingRouter = {
  list: listSalesGoalRanking,
  listPeriods: listSalesGoalPeriods,
  import: importSalesGoalRanking,
  upsertEntry: upsertSalesGoalEntry,
  deleteEntry: deleteSalesGoalEntry,
  updateBranch: updateSalesGoalBranch,
  evolution: listSalesGoalEvolution,
  settings: {
    get: getSalesGoalRankingSettings,
    update: updateSalesGoalRankingSettings,
  },
};
