import { getDashboard } from "./get-dashboard";
import { listOrganizations } from "./list-organizations";
import { getOrganization } from "./get-organization";
import { adjustStars } from "./adjust-stars";
import { updateOrgPlan } from "./update-org-plan";
import { adminUpdateMemberRole } from "./update-member-role";
import { setSystemAdmin } from "./set-system-admin";
import { listPlans } from "./list-plans";
import { listTransactions } from "./list-transactions";

export const adminRouter = {
  getDashboard,
  listOrganizations,
  getOrganization,
  adjustStars,
  updateOrgPlan,
  updateMemberRole: adminUpdateMemberRole,
  setSystemAdmin,
  listPlans,
  listTransactions,
};
