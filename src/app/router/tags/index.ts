import { createTag } from "./create";
import { deleteTag } from "./delete";
import { getTagByLead } from "./get-tag-by-lead";
import { listTags } from "./list";
import { listTagsWithoutWidget } from "./list-tag-without-widget";
import { syncWhatsappTags } from "./sync-whatsapp";
import { updateTag } from "./update";

export const tagsRouter = {
  createTag,
  listTags,
  syncWhatsappTags,
  deleteTag,
  updateTag,
  getTagByLead,
  listTagsWithoutWidget,
};
