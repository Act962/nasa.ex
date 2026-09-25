import {
  createCommand,
  draftCommand,
  getCommand,
  listCommands,
  runCommandNow,
  setCommandStatus,
  setOrgPaused,
  updateCommand,
} from "./commands";
import { getRun, getUsage, listApprovals, listRuns } from "./runs";
import { approveAction, rejectAction } from "./approvals";
import { listCommandTools } from "./tools";

/** ASTRO COMMANDER (spec 0023). */
export const astroCommanderRouter = {
  commands: {
    list: listCommands,
    get: getCommand,
    draft: draftCommand,
    create: createCommand,
    update: updateCommand,
    setStatus: setCommandStatus,
    runNow: runCommandNow,
    setOrgPaused,
  },
  runs: {
    list: listRuns,
    get: getRun,
    usage: getUsage,
  },
  tools: {
    list: listCommandTools,
  },
  approvals: {
    list: listApprovals,
    approve: approveAction,
    reject: rejectAction,
  },
};
