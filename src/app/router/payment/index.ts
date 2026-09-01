// verifyPaymentPin, verifyPaymentOtp, requestPaymentOtp e
// setupOwnerPaymentAccess foram DESREGISTRADAS pela spec 0007 — o acesso ao
// módulo passou a ser determinado só pela whitelist. Os handlers continuam em
// `./access` de propósito; religar exige spec nova.
import {
  getMyPaymentAccess,
  claimOwnerPaymentAccess,
  listPaymentAccess,
  grantPaymentAccess,
  revokePaymentAccess,
  updatePaymentRole,
  updatePaymentPermissions,
  startWebauthnRegistration,
  finishWebauthnRegistration,
  startWebauthnAuth,
  finishWebauthnAuth,
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
  listRecentEntryDescriptions,
  createPaymentEntry,
  updatePaymentEntry,
  payPaymentEntry,
  deletePaymentEntry,
  removePaymentEntry,
} from "./entries";
import {
  listPaymentAttachments,
  updatePaymentAttachment,
  deletePaymentAttachment,
  linkPaymentAttachments,
} from "./attachments";
import { getPaymentDashboard, getCashflow } from "./dashboard";
import { getPaymentProjection } from "./projection";
import { getIncomeStatement, getOperationalResult } from "./reports";
import { listExternalContacts } from "./external-contacts";
import { listActiveContracts } from "./contracts";
import {
  listPendingPaymentApprovals,
  canCurrentUserApprovePayment,
  approvePaymentRequest,
  rejectPaymentRequest,
  cancelPaymentApprovalRequest,
  getPaymentGovernanceConfig,
  updatePaymentGovernanceConfig,
  getNerpFinancialFlag,
  updateNerpFinancialFlag,
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
    getMy:              getMyPaymentAccess,
    claimOwner:         claimOwnerPaymentAccess,
    list:               listPaymentAccess,
    grant:              grantPaymentAccess,
    revoke:             revokePaymentAccess,
    updateRole:         updatePaymentRole,
    updatePermissions:  updatePaymentPermissions,
    startWebauthnReg:   startWebauthnRegistration,
    finishWebauthnReg:  finishWebauthnRegistration,
    startWebauthnAuth:  startWebauthnAuth,
    finishWebauthnAuth: finishWebauthnAuth,
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
    recentDescriptions: listRecentEntryDescriptions,
    create: createPaymentEntry,
    update: updatePaymentEntry,
    pay: payPaymentEntry,
    delete: deletePaymentEntry,
    remove: removePaymentEntry,
  },
  attachments: {
    list:   listPaymentAttachments,
    update: updatePaymentAttachment,
    delete: deletePaymentAttachment,
    link:   linkPaymentAttachments,
  },
  dashboard: {
    get: getPaymentDashboard,
    cashflow: getCashflow,
  },
  projection: {
    get: getPaymentProjection,
  },
  reports: {
    incomeStatement: getIncomeStatement,
    operationalResult: getOperationalResult,
  },
  externalContacts: {
    list: listExternalContacts,
  },
  contracts: {
    listActive: listActiveContracts,
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
  nerp: {
    getFlag:    getNerpFinancialFlag,
    updateFlag: updateNerpFinancialFlag,
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
