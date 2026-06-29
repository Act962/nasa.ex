import { createTagGroup } from "./create";
import { deleteTagGroup } from "./delete";
import { listTagGroups } from "./list";
import { reorderTagGroups } from "./reorder";
import { updateTagGroup } from "./update";

export const tagGroupsRouter = {
  list: listTagGroups,
  create: createTagGroup,
  update: updateTagGroup,
  delete: deleteTagGroup,
  reorder: reorderTagGroups,
};
