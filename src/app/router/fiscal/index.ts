import { fiscalProfileGet } from "./profile-get";
import { fiscalProfileUpsert } from "./profile-upsert";
import { fiscalProfileDelete } from "./profile-delete";
import { fiscalProfileSyncStatus } from "./profile-sync-status";
import { issueFiscalInvoice } from "./invoices/issue";
import { listFiscalInvoicesByContract } from "./invoices/list-by-contract";
import { getFiscalInvoice } from "./invoices/get";
import { refreshFiscalInvoiceStatus } from "./invoices/refresh-status";
import { cancelFiscalInvoice } from "./invoices/cancel";

export const fiscalRouter = {
  profile: {
    get: fiscalProfileGet,
    upsert: fiscalProfileUpsert,
    delete: fiscalProfileDelete,
    syncCompanyStatus: fiscalProfileSyncStatus,
  },
  invoices: {
    issueFromContract: issueFiscalInvoice,
    listByContract: listFiscalInvoicesByContract,
    get: getFiscalInvoice,
    refreshStatus: refreshFiscalInvoiceStatus,
    cancel: cancelFiscalInvoice,
  },
};
