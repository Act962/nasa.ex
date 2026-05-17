import { getNerpOrgProcedure } from "./get";
import { checkNerpSubdomainProcedure } from "./check-subdomain";
import { updateNerpSubdomainProcedure } from "./update-subdomain";

export const nerpOrgRouter = {
  get: getNerpOrgProcedure,
  checkSubdomain: checkNerpSubdomainProcedure,
  updateSubdomain: updateNerpSubdomainProcedure,
};
