import { pendingCriticals } from "./pending-criticals";
import { acknowledgeAlert } from "./acknowledge";
import { getAlertCatalog } from "./catalog";
import { listAlertRules } from "./list-rules";
import { createAlertRule } from "./create-rule";
import { updateAlertRule } from "./update-rule";
import { deleteAlertRule } from "./delete-rule";
import { listEditorOptions } from "./editor-options";
import { listLeadsWithAlerts } from "./leads-with-alerts";

export const alertsRouter = {
  pendingCriticals,
  acknowledge: acknowledgeAlert,
  catalog: getAlertCatalog,
  listRules: listAlertRules,
  createRule: createAlertRule,
  updateRule: updateAlertRule,
  deleteRule: deleteAlertRule,
  editorOptions: listEditorOptions,
  leadsWithAlerts: listLeadsWithAlerts,
};
