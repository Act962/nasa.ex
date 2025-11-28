import { listStatus } from "./list-status";
import { listStatusSimple } from "./list-status-simple";
import { createStatus } from "./create";
import { updateStatus } from "./update";
import { updateStatusOrder } from "./update-order";

export const statusRoutes = {
  list: listStatus,
  listSimple: listStatusSimple,
  create: createStatus,
  update: updateStatus,
  updateOrder: updateStatusOrder,
};
