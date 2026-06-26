import { fiscalProfileGet } from "./profile-get";
import { fiscalProfileUpsert } from "./profile-upsert";
import { fiscalProfileDelete } from "./profile-delete";
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
    delete: fiscalProfileDelete,
  },
  invoices: {
    issueFromContract: issueFiscalInvoice,
    listByContract: listFiscalInvoicesByContract,
    get: getFiscalInvoice,
    refreshStatus: refreshFiscalInvoiceStatus,
    cancel: cancelFiscalInvoice,
  },
};
