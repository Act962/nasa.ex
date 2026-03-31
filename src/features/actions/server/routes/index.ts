import { createAction } from "./create";
import { getAction } from "./get";
import { listActionByColumn } from "./list-action-by-column";
import { listActionByWorkspace } from "./list-action-by-workspace";
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

import { getAnalytics } from "./get-analytics";
import { listRecentActions } from "./list-recent";
import { addParticipant } from "./add-participant";
import { removeParticipant } from "./remove-participant";

export const actionRoutes = {
  getAnalytics,
  listRecent: listRecentActions,
  create: createAction,
  listByColumn: listActionByColumn,
  listByWorkspace: listActionByWorkspace,
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
  addParticipant,
  removeParticipant,
};
