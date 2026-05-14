import { listPublic } from "./list-public";
import { getPublicEvent } from "./get-public";
import { getByOrgShare } from "./get-by-org-share";
import { toggleLike } from "./toggle-like";
import { recordView } from "./record-view";
import { generateShareToken } from "./generate-share-token";
import { getTopSharers } from "./get-top-sharers";
import { listCategories } from "./list-categories";
import { listLocations } from "./list-locations";
import { listOrganizations } from "./list-organizations";
import { resolveMapsLocation } from "./resolve-maps-location";
import { quickCreateFromLink } from "./quick-create-from-link";
import { submitClaim } from "./submit-claim";
import { submitReport } from "./submit-report";
import { getClaimByToken } from "./get-claim-by-token";
import { respondToClaim } from "./respond-to-claim";

export const calendarRouter = {
  listPublic,
  getPublicEvent,
  getByOrgShare,
  toggleLike,
  recordView,
  generateShareToken,
  getTopSharers,
  listCategories,
  listLocations,
  listOrganizations,
  resolveMapsLocation,
  quickCreateFromLink,
  submitClaim,
  submitReport,
  getClaimByToken,
  respondToClaim,
};
