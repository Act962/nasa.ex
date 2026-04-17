import { getDashboard } from "./get-dashboard";
import { listOrganizations } from "./list-organizations";
import { getOrganization } from "./get-organization";
import { adjustStars } from "./adjust-stars";
import { updateOrgPlan } from "./update-org-plan";
import { adminUpdateMemberRole } from "./update-member-role";
import { updateMemberCargo } from "./update-member-cargo";
import { setSystemAdmin } from "./set-system-admin";
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanActive,
} from "./plans";
import { listTransactions } from "./list-transactions";
import { listUsers } from "./list-users";
import { getUser } from "./get-user";
import { updateUser } from "./update-user";
import { deleteUser } from "./delete-user";
import { getOrgPermissions } from "./get-org-permissions";
import { setOrgPermission } from "./set-org-permission";
import { listInstances } from "./list-instances";
import { listAppCosts } from "./list-app-costs";
import { updateAppCost } from "./update-app-cost";
import { sendNotification } from "./send-notification";
import { deleteNotification } from "./delete-notification";
import { listNotifications } from "./list-notifications";
import { adminCreateOrgUser } from "./create-org-user";
import { adminRemoveMember } from "./remove-member";
import { adminUpdateMember } from "./update-member";
import { deleteAppTemplate } from "./delete-app-template";
import {
  listPlatformAssets,
  setPlatformAsset,
  deletePlatformAsset,
  listSpaceLevels,
  updateSpaceLevel,
} from "./assets";
import {
  listGatewayConfigs,
  setGatewayConfig,
  deleteGatewayConfig,
  toggleGatewayActive,
  listStarsPayments,
} from "./payments";
import {
  listOrgDistributions,
  setOrgDistribution,
  setOrgMemberBudget,
} from "./star-distribution";
import {
  adminGetStarRules,
  adminCreateStarRule,
  adminUpdateStarRule,
} from "./star-rules";

export const adminRouter = {
  getDashboard,
  listOrganizations,
  getOrganization,
  adjustStars,
  updateOrgPlan,
  updateMemberRole: adminUpdateMemberRole,
  updateMemberCargo,
  setSystemAdmin,
  listPlans,
  listTransactions,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  getOrgPermissions,
  setOrgPermission,
  listInstances,
  listAppCosts,
  updateAppCost,
  sendNotification,
  deleteNotification,
  listNotifications,
  createOrgUser: adminCreateOrgUser,
  removeMember: adminRemoveMember,
  updateMember: adminUpdateMember,
  deleteAppTemplate,
  listPlatformAssets,
  setPlatformAsset,
  deletePlatformAsset,
  listSpaceLevels,
  updateSpaceLevel,
  // Payment gateways
  listGatewayConfigs,
  setGatewayConfig,
  deleteGatewayConfig,
  toggleGatewayActive,
  listStarsPayments,
  // Plans CRUD
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanActive,
  // Star distribution
  listOrgDistributions,
  setOrgDistribution,
  setOrgMemberBudget,
  // Star rules
  adminGetStarRules,
  adminCreateStarRule,
  adminUpdateStarRule,
};
