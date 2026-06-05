import { getPagesCost } from "./get-cost";
import { createPage } from "./create-page";
import { listPages } from "./list-pages";
import { getPage } from "./get-page";
import { updatePage } from "./update-page";
import { publishPage } from "./publish-page";
import { unpublishPage } from "./unpublish-page";
import { deletePage } from "./delete-page";
import { duplicatePage } from "./duplicate-page";
import { getPageResources } from "./get-resources";
import { listPageTemplates } from "./list-templates";
import { listPageVersions } from "./list-versions";
import { restorePageVersion } from "./restore-version";
import { getPagePublic } from "./public-get";
import { getPagePublicByDomain } from "./public-get-by-domain";
import { registerPageVisit } from "./register-visit";
import { setCustomDomain } from "./set-custom-domain";
import { verifyCustomDomain } from "./verify-custom-domain";
import { searchDomain } from "./domain-search";
import { startPurchaseDomain } from "./domain-start-purchase";
import { getDomainPurchaseStatus } from "./domain-purchase-status";
import { inlineEditSave } from "./inline-edit-save";
import { cloneFromUrl } from "./clone-from-url";
import { getPageAnalytics } from "./get-analytics";

export const pagesRouter = {
  getAnalytics: getPageAnalytics,
  getCost: getPagesCost,
  createPage,
  listPages,
  getPage,
  updatePage,
  publishPage,
  unpublishPage,
  deletePage,
  duplicatePage,
  getResources: getPageResources,
  listTemplates: listPageTemplates,
  listVersions: listPageVersions,
  restoreVersion: restorePageVersion,
  publicGet: getPagePublic,
  publicGetByDomain: getPagePublicByDomain,
  registerVisit: registerPageVisit,
  setCustomDomain,
  verifyCustomDomain,
  domainSearch: searchDomain,
  domainStartPurchase: startPurchaseDomain,
  domainPurchaseStatus: getDomainPurchaseStatus,
  inlineEditSave,
  cloneFromUrl,
};
