import {
  closeFormPeriod,
  generateClosingReceivables,
  getFormClosing,
  reopenFormPeriod,
  saveClosingSharedCosts,
} from "./closings";
import { searchLookup } from "./lookup";
import { listFormRecords } from "./records";

export const formRecordsRouter = {
  lookup: { search: searchLookup },
  records: { list: listFormRecords },
  closings: {
    get: getFormClosing,
    saveSharedCosts: saveClosingSharedCosts,
    close: closeFormPeriod,
    reopen: reopenFormPeriod,
    generateReceivables: generateClosingReceivables,
  },
};
