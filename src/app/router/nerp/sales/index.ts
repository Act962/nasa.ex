import { listNerpSales } from "./list";
import { getNerpSale } from "./get";
import { createNerpSale } from "./create";

// Nerp não expõe `update` nem `delete` em sales — vendas são imutáveis após criação.
export const nerpSalesRouter = {
  list: listNerpSales,
  get: getNerpSale,
  create: createNerpSale,
};
