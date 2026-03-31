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
import { listTags } from "./list-tags";
import { createTag } from "./create-tag";
import { updateTag } from "./update-tag";
import { deleteTag } from "./delete-tag";
import { addTagToAction } from "./add-tag-to-action";
import { removeTagFromAction } from "./remove-tag-from-action";
import { listAutomations } from "./list-automations";
import { createAutomation } from "./create-automation";
import { updateAutomation } from "./update-automation";
import { deleteAutomation } from "./delete-automation";
import { listFolders } from "./list-folders";
import { createFolder } from "./create-folder";
import { deleteFolder } from "./delete-folder";
import { updateActionFields } from "./update-action-fields";
import { copyAction } from "./copy-action";
import { moveAction } from "./move-action";
import { shareAction } from "./share-action";
import { listIncomingShares } from "./list-incoming-shares";
import { listOutgoingShares } from "./list-outgoing-shares";
import { approveShare } from "./approve-share";
import { rejectShare } from "./reject-share";
import { getCompanyCode } from "./get-company-code";

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
  listTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToAction,
  removeTagFromAction,
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  listFolders,
  createFolder,
  deleteFolder,
  updateActionFields,
  copyAction,
  moveAction,
  shareAction,
  listIncomingShares,
  listOutgoingShares,
  approveShare,
  rejectShare,
  getCompanyCode,
};
