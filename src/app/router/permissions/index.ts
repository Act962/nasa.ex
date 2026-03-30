import { getPermissions } from "./get-permissions";
import { updatePermission } from "./update-permission";
import { updateMemberRole } from "./update-member-role";
import { removeMember } from "./remove-member";

export const permissionsRouter = {
  getPermissions,
  updatePermission,
  updateMemberRole,
  removeMember,
};
