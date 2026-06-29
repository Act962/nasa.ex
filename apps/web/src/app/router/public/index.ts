import { listPublicPlans } from "./list-plans";
import { calendarRouter } from "./calendar";
import { spaceRouter } from "./space";

export const publicRouter = {
  listPlans: listPublicPlans,
  calendar: calendarRouter,
  space: spaceRouter,
};
