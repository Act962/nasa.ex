import { listPublicPlans } from "./list-plans";
import { calendarRouter } from "./calendar";
import { spaceRouter } from "./space";
import { publicCatalogOrderRouter } from "./catalog-order";

export const publicRouter = {
  listPlans: listPublicPlans,
  calendar: calendarRouter,
  space: spaceRouter,
  catalogOrder: publicCatalogOrderRouter,
};
