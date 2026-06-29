import { listNerpCustomers } from "./list";
import { getNerpCustomer } from "./get";
import { createNerpCustomer } from "./create";
import { updateNerpCustomer } from "./update";
import { deleteNerpCustomer } from "./delete";

export const nerpCustomerRouter = {
  list: listNerpCustomers,
  get: getNerpCustomer,
  create: createNerpCustomer,
  update: updateNerpCustomer,
  delete: deleteNerpCustomer,
};
