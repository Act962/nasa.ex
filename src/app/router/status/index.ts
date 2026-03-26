import { listStatusSimple } from "./list-status-simple";
import { createStatus } from "./create";
import { updateStatus } from "./update";
import { getMany } from "./get-many";
import { updateNewOrder } from "./update-new-order";
import { deleteStatus } from "./delete";

export const statusRoutes = {
  getMany,
  listSimple: listStatusSimple,
  create: createStatus,
  update: updateStatus,
  updateNewOrder,
  delete: deleteStatus,
};
