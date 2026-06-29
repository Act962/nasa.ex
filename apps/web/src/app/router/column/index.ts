import { createColumn } from "./create";
import { deleteColumn } from "./delete";
import { getMany } from "./get-many";
import { listColumnSimple } from "./list-simple";
import { updateNewOrder } from "./update-new-order";
import { updateColumn } from "./update";

export const columnRoutes = {
  getMany,
  listSimple: listColumnSimple,
  create: createColumn,
  update: updateColumn,
  updateNewOrder,
  delete: deleteColumn,
};
