import {
  connectChannelProcedure,
  disconnectChannel,
  getChannel,
  listContent,
  reactivateChannel,
  repairSubscription,
} from "./channel";
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
 * chamam use case ou repositório.
 */
export const commentsRouter = {
  channel: {
    get: getChannel,
    connect: connectChannelProcedure,
    disconnect: disconnectChannel,
    reactivate: reactivateChannel,
    listContent,
    repairSubscription,
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
