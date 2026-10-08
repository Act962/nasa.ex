import {
  closeFormPeriod,
  generateClosingReceivables,
  getFormClosing,
  reopenFormPeriod,
  saveClosingSharedCosts,
} from "./closings";
import { getQuickClientDefaults, searchLookup } from "./lookup";
import { listClientRecords } from "./public";
import { listFormRecords } from "./records";
import { getFormWorkspace } from "./workspace";

export const formRecordsRouter = {
  lookup: { search: searchLookup, quickClientDefaults: getQuickClientDefaults },
  records: { list: listFormRecords },
  workspace: { get: getFormWorkspace },
  public: { list: listClientRecords },
  closings: {
    get: getFormClosing,
    saveSharedCosts: saveClosingSharedCosts,
    close: closeFormPeriod,
    reopen: reopenFormPeriod,
    generateReceivables: generateClosingReceivables,
  },
};
