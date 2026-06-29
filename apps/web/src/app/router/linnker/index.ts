import { createLinnkerPage } from "./create-page";
import { listLinnkerPages } from "./list-pages";
import { getLinnkerPage } from "./get-page";
import { updateLinnkerPage } from "./update-page";
import { deleteLinnkerPage } from "./delete-page";
import { createLinnkerLink } from "./create-link";
import { updateLinnkerLink } from "./update-link";
import { deleteLinnkerLink } from "./delete-link";
import { reorderLinnkerLinks } from "./reorder-links";
import { getLinnkerPublic } from "./public-get";
import { registerLinnkerScan } from "./register-scan";
import { getLinnkerScans } from "./get-scans";
import { getLinnkerResources } from "./get-resources";
import { captureLinnkerLead } from "./capture-lead";

export const linnkerRouter = {
  createPage: createLinnkerPage,
  listPages: listLinnkerPages,
  getPage: getLinnkerPage,
  updatePage: updateLinnkerPage,
  deletePage: deleteLinnkerPage,
  createLink: createLinnkerLink,
  updateLink: updateLinnkerLink,
  deleteLink: deleteLinnkerLink,
  reorderLinks: reorderLinnkerLinks,
  getPublic: getLinnkerPublic,
  registerScan: registerLinnkerScan,
  getScans: getLinnkerScans,
  getResources: getLinnkerResources,
  captureLead: captureLinnkerLead,
};
