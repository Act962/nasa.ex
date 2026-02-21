import { searchLeads } from "./search";
import { createLead } from "./create-lead";
import { updateLead } from "./update";
import { deleteLead } from "./delete";
import { addLeadFirst } from "./add-lead-to-first";
import { addLeadLast } from "./add-lead-to-last";
// import { updateLeadOrder } from "./update-order";
import { getLead } from "./get";
import { listLead } from "./list";
import { createLeadWithTags } from "./create-lead-with-tags";
import { updateLeadAction } from "./update-action";
import { archiveLead } from "./archive";
import { listActionsByLead } from "./list-actions";
import { createActionByLead } from "./create-action-by-lead";
import { updateActionByLead } from "./update-action-by-lead";
import { listLeadByWhats } from "./list-lead-by-whats";
import { listLeadWithoutConversation } from "./list-without-conversation";
import { updateNewOrder } from "./update-new-order";
import { listLeadsByStatus } from "./get-many";
import { updateManyStatusLead } from "./update-many-status";
import { listLeadFiles } from "./list-files";
import { createLeadFile } from "./create-file";

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
  // updateOrder: updateLeadOrder,
  updateAction: updateLeadAction,
  archive: archiveLead,
  listActions: listActionsByLead,
  createAction: createActionByLead,
  updateActionByLead: updateActionByLead,
  listLeadByWhats: listLeadByWhats,
  listLeadWithoutConversation: listLeadWithoutConversation,
  updateNewOrder: updateNewOrder,
  listLeadsByStatus,
  updateManyStatus: updateManyStatusLead,
  listFiles: listLeadFiles,
  createFile: createLeadFile,
};
