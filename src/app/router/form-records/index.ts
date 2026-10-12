import {
  closeFormPeriod,
  generateClosingReceivables,
  getFormClosing,
  reopenFormPeriod,
  saveClosingSharedCosts,
} from "./closings";
import { getQuickClientDefaults, searchLookup } from "./lookup";
import { getRecordNotices, saveRecordNotices } from "./notices";
import { getRecordPixSettings, getRecordPixStatus, markRecordPaid, saveRecordPixSettings, sendRecordPixToClient } from "./pix";
import { listClientRecords } from "./public";
import { listFormRecords } from "./records";
import { getFormWorkspace } from "./workspace";

export const formRecordsRouter = {
  lookup: { search: searchLookup, quickClientDefaults: getQuickClientDefaults },
  records: { list: listFormRecords },
  workspace: { get: getFormWorkspace },
  public: { list: listClientRecords },
  notices: { get: getRecordNotices, save: saveRecordNotices },
  pix: {
    settings: getRecordPixSettings,
    saveSettings: saveRecordPixSettings,
    status: getRecordPixStatus,
    send: sendRecordPixToClient,
    markPaid: markRecordPaid,
  },
  closings: {
    get: getFormClosing,
    saveSharedCosts: saveClosingSharedCosts,
    close: closeFormPeriod,
    reopen: reopenFormPeriod,
    generateReceivables: generateClosingReceivables,
  },
};
