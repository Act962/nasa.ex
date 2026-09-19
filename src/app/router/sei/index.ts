import { linkSeiProcess } from "./link-process";
import { listLeadSeiProcesses } from "./list-lead-processes";
import { requestSeiProcessSync } from "./request-sync";
import { unlinkSeiProcess } from "./unlink-process";

export const seiRouter = {
  linkProcess: linkSeiProcess,
  listLeadProcesses: listLeadSeiProcesses,
  requestSync: requestSeiProcessSync,
  unlinkProcess: unlinkSeiProcess,
};
