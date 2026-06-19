import { fiscalProfileGet, fiscalProfileUpsert } from "./profile";
import {
  issueFiscalInvoice,
  listFiscalInvoicesByContract,
  getFiscalInvoice,
  refreshFiscalInvoiceStatus,
  cancelFiscalInvoice,
} from "./invoices";

export const fiscalRouter = {
  profile: {
    get: fiscalProfileGet,
    upsert: fiscalProfileUpsert,
  },
  invoices: {
    issueFromContract: issueFiscalInvoice,
    listByContract: listFiscalInvoicesByContract,
    get: getFiscalInvoice,
    refreshStatus: refreshFiscalInvoiceStatus,
    cancel: cancelFiscalInvoice,
  },
};
