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
import { resolvePublicPage } from "./public-resolve";
import { resolvePublicPageByDomain } from "./public-resolve-by-domain";
import { registerPageVisit } from "./register-visit";
import { setCustomDomain } from "./set-custom-domain";
import { verifyCustomDomain } from "./verify-custom-domain";
import { searchDomain } from "./domain-search";
import { startPurchaseDomain } from "./domain-start-purchase";
import { getDomainPurchaseStatus } from "./domain-purchase-status";
import { inlineEditSave } from "./inline-edit-save";
import { cloneFromUrl } from "./clone-from-url";
import { getPageAnalytics } from "./get-analytics";
import { createSubpage } from "./create-subpage";
import { listSubpages } from "./list-subpages";
import { reorderSubpages } from "./reorder-subpages";
import { setAsHome } from "./set-as-home";
import { bulkUpdateSubpagesElement } from "./bulk-update-subpages-element";
import { updatePageSlug } from "./update-page-slug";

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
  publicResolve: resolvePublicPage,
  publicResolveByDomain: resolvePublicPageByDomain,
  registerVisit: registerPageVisit,
  setCustomDomain,
  verifyCustomDomain,
  domainSearch: searchDomain,
  domainStartPurchase: startPurchaseDomain,
  domainPurchaseStatus: getDomainPurchaseStatus,
  inlineEditSave,
  cloneFromUrl,
  // Multi-page (mudança 6)
  createSubpage,
  listSubpages,
  reorderSubpages,
  setAsHome,
  bulkUpdateSubpagesElement,
  // Customização de URL
  updatePageSlug,
};
