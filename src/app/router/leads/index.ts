import { searchLeads } from "./search";
import { createLead } from "./create-lead";
import { updateLead } from "./update";
import { deleteLead } from "./delete";
import { addLeadFirst } from "./add-lead-to-first";
import { addLeadLast } from "./add-lead-to-last";
import { updateLeadOrder } from "./update-order";
import { getLead } from "./get";
import { listLead } from "./list";
import { createLeadWithTags } from "./create-lead-with-tags";
import { updateLeadAction } from "./update-action";
import { archiveLead } from "./archive";
import { listActionsByLead } from "./list-actions";

export const leadRoutes = {
  list: listLead,
  get: getLead,
  search: searchLeads,
  create: createLead,
  createWithTags: createLeadWithTags,
  update: updateLead,
  delete: deleteLead,
  addToFirst: addLeadFirst,
  addToLast: addLeadLast,
  updateOrder: updateLeadOrder,
  updateAction: updateLeadAction,
  archive: archiveLead,
  listActions: listActionsByLead,
};
