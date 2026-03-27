import { createAction } from "./create";
import { getAction } from "./get";
import { listActionByColumn } from "./list-action-by-column";
import { listActionByWorkspace } from "./list-action-by-workspace";
import { reorderAction } from "./reorder";

export const actionRoutes = {
  create: createAction,
  listByColumn: listActionByColumn,
  listByWorkspace: listActionByWorkspace,
  reorder: reorderAction,
  get: getAction,
};
