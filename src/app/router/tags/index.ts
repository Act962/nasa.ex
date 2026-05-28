import { createTag } from "./create";
import { deleteTag } from "./delete";
import { getDuplicateTags } from "./get-duplicates";
import { getReferencedWorkflows } from "./get-referenced-workflows";
import { getTagByLead } from "./get-tag-by-lead";
import { listTags } from "./list";
import { listTagsWithoutWidget } from "./list-tag-without-widget";
import { mergeDuplicateTags } from "./merge-duplicates";
import { purgeTag } from "./purge";
import { syncWhatsappTags } from "./sync-whatsapp";
import { updateTag } from "./update";

export const tagsRouter = {
  createTag,
  listTags,
  syncWhatsappTags,
  deleteTag,
  purgeTag,
  updateTag,
  getTagByLead,
  listTagsWithoutWidget,
  getReferencedWorkflows,
  getDuplicateTags,
  mergeDuplicateTags,
};
