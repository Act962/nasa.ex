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
import {
  listPendingPaymentApprovals,
  canCurrentUserApprovePayment,
  approvePaymentRequest,
  rejectPaymentRequest,
  cancelPaymentApprovalRequest,
  getPaymentGovernanceConfig,
  updatePaymentGovernanceConfig,
} from "./approvals";
import {
  listDunningRules,
  createDunningRule,
  updateDunningRule,
  deleteDunningRule,
  createDunningStep,
  updateDunningStep,
  deleteDunningStep,
  assignDunningRuleToEntry,
  listDunningExecutionsByEntry,
} from "./dunning";

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
  // ── NASA Payment Fase 2: Governança + Aprovação ──────────────────────
  approvals: {
    listPending: listPendingPaymentApprovals,
    canApprove:  canCurrentUserApprovePayment,
    approve:     approvePaymentRequest,
    reject:      rejectPaymentRequest,
    cancel:      cancelPaymentApprovalRequest,
  },
  governance: {
    get:    getPaymentGovernanceConfig,
    update: updatePaymentGovernanceConfig,
  },
  // ── NASA Payment Fase 2: Régua de cobrança (event-driven via Inngest) ─
  dunning: {
    rules: {
      list:   listDunningRules,
      create: createDunningRule,
      update: updateDunningRule,
      delete: deleteDunningRule,
    },
    steps: {
      create: createDunningStep,
      update: updateDunningStep,
      delete: deleteDunningStep,
    },
    entries: {
      assignRule: assignDunningRuleToEntry,
    },
    executions: {
      listByEntry: listDunningExecutionsByEntry,
    },
  },
};
