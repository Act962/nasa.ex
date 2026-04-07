import {
  verifyPaymentPin,
  listPaymentAccess,
  grantPaymentAccess,
  revokePaymentAccess,
} from "./access";
import {
  listPaymentAccounts,
  createPaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount,
} from "./accounts";
import {
  listPaymentCategories,
  createPaymentCategory,
  updatePaymentCategory,
  deletePaymentCategory,
} from "./categories";
import {
  listPaymentContacts,
  createPaymentContact,
  updatePaymentContact,
  deletePaymentContact,
} from "./contacts";
import {
  listPaymentEntries,
  createPaymentEntry,
  updatePaymentEntry,
  payPaymentEntry,
  deletePaymentEntry,
} from "./entries";
import { getPaymentDashboard, getCashflow } from "./dashboard";
import { listExternalContacts } from "./external-contacts";

export const paymentRouter = {
  access: {
    verify: verifyPaymentPin,
    list: listPaymentAccess,
    grant: grantPaymentAccess,
    revoke: revokePaymentAccess,
  },
  accounts: {
    list: listPaymentAccounts,
    create: createPaymentAccount,
    update: updatePaymentAccount,
    delete: deletePaymentAccount,
  },
  categories: {
    list: listPaymentCategories,
    create: createPaymentCategory,
    update: updatePaymentCategory,
    delete: deletePaymentCategory,
  },
  contacts: {
    list: listPaymentContacts,
    create: createPaymentContact,
    update: updatePaymentContact,
    delete: deletePaymentContact,
  },
  entries: {
    list: listPaymentEntries,
    create: createPaymentEntry,
    update: updatePaymentEntry,
    pay: payPaymentEntry,
    delete: deletePaymentEntry,
  },
  dashboard: {
    get: getPaymentDashboard,
    cashflow: getCashflow,
  },
  externalContacts: {
    list: listExternalContacts,
  },
};
