import { pendingCriticals } from "./pending-criticals";
import { acknowledgeAlert } from "./acknowledge";
import { getAlertCatalog } from "./catalog";

export const alertsRouter = {
  pendingCriticals,
  acknowledge: acknowledgeAlert,
  catalog: getAlertCatalog,
};
