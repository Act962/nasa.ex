import { adminAdjustUserPoints, adminCreateOrgRule, adminGetOrgRules, adminGetOrgUsers, adminGetSpaceOverview, adminUpdateOrgRule } from "./admin-routes";
import { createSpacePointRule, deleteSpacePointPrize, deleteSpacePointRule, earnSpacePoints, getMySpacePoint, getSpacePointPrizes, getSpacePointRanking, getSpacePointRules, getUserStats, updateSpacePointRule, upsertSpacePointPrize } from "./user-routes";


// ─── Router export ────────────────────────────────────────────────────────────
export const spacePointRouter = {
  me: getMySpacePoint,
  earn: earnSpacePoints,
  ranking: getSpacePointRanking,
  userStats: getUserStats,
  rules: getSpacePointRules,
  updateRule: updateSpacePointRule,
  createRule: createSpacePointRule,
  deleteRule: deleteSpacePointRule,
  prizes: getSpacePointPrizes,
  upsertPrize: upsertSpacePointPrize,
  deletePrize: deleteSpacePointPrize,
  adminOverview: adminGetSpaceOverview,
  adminOrgUsers: adminGetOrgUsers,
  adminAdjust: adminAdjustUserPoints,
  adminOrgRules: adminGetOrgRules,
  adminCreateRule: adminCreateOrgRule,
  adminUpdateRule: adminUpdateOrgRule,
};
