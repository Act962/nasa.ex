import { createTag } from "./create";
import { deleteTag } from "./delete";
import { listTags } from "./list";
import { syncWhatsappTags } from "./sync-whatsapp";
import { updateTag } from "./update";

export const tagsRouter = {
  createTag,
  listTags,
  syncWhatsappTags,
  deleteTag,
  updateTag,
};
