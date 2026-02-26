// import { listStatus } from "./list-status";
import { listStatusSimple } from "./list-status-simple";
import { createStatus } from "./create";
import { updateStatus } from "./update";
// import { updateStatusOrder } from "./update-order";
import { getMany } from "./get-many";
import { updateNewOrder } from "./update-new-order";
import { deleteStatus } from "./delete";

export const statusRoutes = {
  getMany,
  // list: listStatus,
  listSimple: listStatusSimple,
  create: createStatus,
  update: updateStatus,
  // updateOrder: updateStatusOrder,
  updateNewOrder,
  delete: deleteStatus,
};
