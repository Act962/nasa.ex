import { createScript } from "./create";
import { listScripts } from "./list";
import { updateScript } from "./update";
import { deleteScript } from "./delete";

export const scriptsRouter = {
  create: createScript,
  list: listScripts,
  update: updateScript,
  delete: deleteScript,
};
