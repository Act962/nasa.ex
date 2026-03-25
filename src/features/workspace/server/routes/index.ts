import { createWorkspace } from "./create";
import { getWorkspace } from "./get";
import { listWorkspace } from "./list";

export const workspaceRoutes = {
  list: listWorkspace,
  create: createWorkspace,
  get: getWorkspace,
};
