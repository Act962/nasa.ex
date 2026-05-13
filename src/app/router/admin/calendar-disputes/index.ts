import { listDisputes } from "./list-disputes";
import { resolveDispute } from "./resolve-dispute";

export const calendarDisputesRouter = {
  list: listDisputes,
  resolve: resolveDispute,
};
