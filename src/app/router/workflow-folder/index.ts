import { listFolders } from "./list";
import { createFolder } from "./create";
import { updateFolder } from "./update";
import { deleteFolder } from "./delete";
import { moveWorkflow } from "./move-workflow";

export const workflowFolderRoutes = {
  list: listFolders,
  create: createFolder,
  update: updateFolder,
  delete: deleteFolder,
  moveWorkflow,
};
