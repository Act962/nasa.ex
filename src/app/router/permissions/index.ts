import { getPermissions } from "./get-permissions";
import { updatePermission } from "./update-permission";
import { updateMemberRole } from "./update-member-role";
import { removeMember } from "./remove-member";
import { createMember } from "./create-member";
import { setMemberPermissions } from "./set-member-permissions";

export const permissionsRouter = {
  getPermissions,
  updatePermission,
  updateMemberRole,
  removeMember,
  createMember,
  setMemberPermissions,
};
