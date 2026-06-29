import { listNerpProducts } from "./list";
import { getNerpProduct } from "./get";
import { createNerpProduct } from "./create";
import { updateNerpProduct } from "./update";
import { duplicateNerpProduct } from "./duplicate";
import { deleteNerpProduct } from "./delete";

export const nerpProductsRouter = {
  list: listNerpProducts,
  get: getNerpProduct,
  create: createNerpProduct,
  update: updateNerpProduct,
  duplicate: duplicateNerpProduct,
  delete: deleteNerpProduct,
};
