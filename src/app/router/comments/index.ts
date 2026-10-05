import { getLeadTracking, listContent, setLeadTracking } from "./channel";
import {
  createAutomation,
  deleteAutomation,
  deleteTrigger,
  getAutomation,
  listAutomations,
  listRuns,
  renameAutomation,
  saveTrigger,
  setActiveAutomation,
} from "./automations";

/**
 * App COMMENTS — automações de Instagram nativas (spec 0024).
 *
 * Adapter primário do módulo `src/modules/social`. Não há Prisma de domínio
 * aqui: as procedures validam entrada, resolvem tenancy pelo middleware e
 * chamam use case ou repositório. As contas conectadas vêm de
 * `socialAccounts.*` (spec 0069).
 */
export const commentsRouter = {
  channel: {
    listContent,
    leadTracking: getLeadTracking,
    setLeadTracking,
  },
  automations: {
    list: listAutomations,
    get: getAutomation,
    create: createAutomation,
    rename: renameAutomation,
    setActive: setActiveAutomation,
    delete: deleteAutomation,
    saveTrigger,
    deleteTrigger,
    listRuns,
  },
};
