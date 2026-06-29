import { listNerpCategories } from "./list";
import { createNerpCategory } from "./create";
import { updateNerpCategory } from "./update";
import { deleteNerpCategory } from "./delete";

export const nerpCategoriesRouter = {
  list: listNerpCategories,
  create: createNerpCategory,
  update: updateNerpCategory,
  delete: deleteNerpCategory,
};
