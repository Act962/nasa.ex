import { createWorkspace } from "./create";
import { getColumnsByWorkspace } from "./get-columns-by-workspace";
import { getWorkspace } from "./get";
import { listWorkspace } from "./list";

export const workspaceRoutes = {
  list: listWorkspace,
  create: createWorkspace,
  get: getWorkspace,
  getColumnsByWorkspace,
};
