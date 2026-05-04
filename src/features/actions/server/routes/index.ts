import { createAction } from "./create";
import { getAction } from "./get";
import { listActionByColumn } from "./list-action-by-column";
import { listActionByWorkspace } from "./list-action-by-workspace";
import { searchActions } from "./search-actions";
import { reorderAction } from "./reorder";
import { updateAction } from "./update";
import { deleteAction } from "./delete";
import { createSubAction } from "./create-sub-action";
import { updateSubAction } from "./update-sub-action";
import { deleteSubAction } from "./delete-sub-action";
import { addResponsible } from "./add-responsible";
import { removeResponsible } from "./remove-responsible";
import { addSubActionResponsible } from "./add-sub-action-responsible";
import { removeSubActionResponsible } from "./remove-sub-action-responsible";
import { promoteSubAction } from "./promote-sub-action";
import { reorderSubActions } from "./reorder-sub-actions";
import { createSubActionGroup } from "./create-sub-action-group";
import { updateSubActionGroup } from "./update-sub-action-group";
import { deleteSubActionGroup } from "./delete-sub-action-group";
import { reorderSubActionGroups } from "./reorder-sub-action-groups";

import { getAnalytics } from "./get-analytics";
import { listRecentActions } from "./list-recent";
import { addParticipant } from "./add-participant";
import { removeParticipant } from "./remove-participant";
import { getWorkspaceCalendar } from "./get-workspace-calendar";
import { actionChatRoutes } from "./chat";
import { toggleFavoriteGlobal } from "./toggle-favorite-global";
import { toggleFavoritePersonal } from "./toggle-favorite-personal";
import { listFavorites } from "./list-favorites";

export const actionRoutes = {
  getAnalytics,
  listRecent: listRecentActions,
  create: createAction,
  listByColumn: listActionByColumn,
  listByWorkspace: listActionByWorkspace,
  searchActions,
  reorder: reorderAction,
  get: getAction,
  update: updateAction,
  delete: deleteAction,
  createSubAction,
  updateSubAction,
  deleteSubAction,
  addResponsible,
  removeResponsible,
  addSubActionResponsible,
  removeSubActionResponsible,
  promoteSubAction,
  reorderSubActions,
  createSubActionGroup,
  updateSubActionGroup,
  deleteSubActionGroup,
  reorderSubActionGroups,
  addParticipant,
  removeParticipant,
  getWorkspaceCalendar,
  chat: actionChatRoutes,
  toggleFavoriteGlobal,
  toggleFavoritePersonal,
  listFavorites,
};
