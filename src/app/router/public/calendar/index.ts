import { listPublic } from "./list-public";
import { getPublicEvent } from "./get-public";
import { toggleLike } from "./toggle-like";
import { recordView } from "./record-view";
import { generateShareToken } from "./generate-share-token";
import { getTopSharers } from "./get-top-sharers";
import { listCategories } from "./list-categories";
import { listLocations } from "./list-locations";
import { listOrganizations } from "./list-organizations";

export const calendarRouter = {
  listPublic,
  getPublicEvent,
  toggleLike,
  recordView,
  generateShareToken,
  getTopSharers,
  listCategories,
  listLocations,
  listOrganizations,
};
