import { searchLeads } from "./search";
import { createLead } from "./create-lead";
import { updateLead } from "./update";
import { deleteLead } from "./delete";
import { addLeadFirst } from "./add-lead-to-first";
import { addLeadLast } from "./add-lead-to-last";
import { updateLeadOrder } from "./update-order";
import { getLead } from "./get";

export const leadRoutes = {
  get: getLead,
  search: searchLeads,
  create: createLead,
  update: updateLead,
  delete: deleteLead,
  addToFirst: addLeadFirst,
  addToLast: addLeadLast,
  updateOrder: updateLeadOrder,
};
