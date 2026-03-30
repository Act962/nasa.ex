import { createWorkspace } from "./create";
import { getColumnsByWorkspace } from "./get-columns-by-workspace";
import { getWorkspace } from "./get";
import { listWorkspace } from "./list";
import { getWorkspaceMembers } from "./get-members";
import { updateWorkspace } from "./update";
import { deleteWorkspace } from "./delete";
import { createColumn } from "./create-column";
import { updateColumn } from "./update-column";
import { deleteColumn } from "./delete-column";
import { addWorkspaceMember } from "./add-member";
import { removeWorkspaceMember } from "./remove-member";
import { listRecentMembers } from "./list-recent-members";

export const workspaceRoutes = {
  list: listWorkspace,
  create: createWorkspace,
  get: getWorkspace,
  getColumnsByWorkspace,
  getMembers: getWorkspaceMembers,
  update: updateWorkspace,
  delete: deleteWorkspace,
  createColumn,
  updateColumn,
  deleteColumn,
  addMember: addWorkspaceMember,
  removeMember: removeWorkspaceMember,
  listRecentMembers,
};
