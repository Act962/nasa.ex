import { getAccountingOverview } from "./overview";
import { getAccountingProfile, updateAccountingProfile } from "./profile";
import { getCalculatorContext, listAccountingTaxRates, runAccountingCalculator } from "./calculator";
import {
  confirmAccountingAssessment,
  listAccountingAssessments,
  reopenAccountingAssessment,
  runAccountingAssessment,
} from "./assessments";
import { listAccountingObligations, setAccountingObligationStatus } from "./obligations";
import {
  createAccountingAccount,
  getAccountingBalanceSheet,
  getAccountingLedger,
  getAccountingTrialBalance,
  listAccountingAccounts,
  reprocessAccountingJournal,
  setAccountingMapping,
  updateAccountingAccount,
} from "./ledger";
import { getRegularityHistory, getRegularityScore, setDocumentRequirement } from "./compliance";
import { accountingDocumentsRouter } from "./documents";
import { accountingCredentialsRouter } from "./credentials";
import { accountingCreditsRouter } from "./credits";
import { accountingPricingRouter } from "./pricing";

// Aba Contábil do NASA Payment (spec 0051, docs/contabil-overview.md).
export const accountingRouter = {
  overview: { get: getAccountingOverview },
  profile: { get: getAccountingProfile, update: updateAccountingProfile },
  calculator: { context: getCalculatorContext, run: runAccountingCalculator },
  rates: { list: listAccountingTaxRates },
  assessments: {
    list: listAccountingAssessments,
    run: runAccountingAssessment,
    confirm: confirmAccountingAssessment,
    reopen: reopenAccountingAssessment,
  },
  obligations: { list: listAccountingObligations, setStatus: setAccountingObligationStatus },
  chart: {
    list: listAccountingAccounts,
    create: createAccountingAccount,
    update: updateAccountingAccount,
    setMapping: setAccountingMapping,
  },
  reports: {
    trialBalance: getAccountingTrialBalance,
    ledger: getAccountingLedger,
    balanceSheet: getAccountingBalanceSheet,
    reprocess: reprocessAccountingJournal,
  },
  compliance: {
    score: getRegularityScore,
    history: getRegularityHistory,
    setRequirement: setDocumentRequirement,
  },
  documents: accountingDocumentsRouter,
  credentials: accountingCredentialsRouter,
  credits: accountingCreditsRouter,
  pricing: accountingPricingRouter,
};
