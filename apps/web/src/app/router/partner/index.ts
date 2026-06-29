import { getMyLink } from "./get-my-link";
import { getDashboard, getFinancialOverview } from "./dashboard";
import {
  listReferrals,
  getActivityBreakdown,
  listVisits,
  getTierHistory,
} from "./list-referrals";
import { listCommissions, listPayouts, requestAdvance } from "./commissions";
import {
  getActiveTerms,
  acceptTerms,
  getMyAcceptanceHistory,
} from "./terms";
import {
  attachReferralOnSignup,
  consumeReferralFromCookie,
  logLinkVisit,
} from "./attach-referral-on-signup";

export const partnerRouter = {
  // Link
  getMyLink,
  attachReferralOnSignup,
  consumeReferralFromCookie,
  logLinkVisit,
  // Dashboard
  getDashboard,
  getFinancialOverview,
  // Indicações
  listReferrals,
  getActivityBreakdown,
  listVisits,
  getTierHistory,
  // Financeiro
  listCommissions,
  listPayouts,
  requestAdvance,
  // Termos
  getActiveTerms,
  acceptTerms,
  getMyAcceptanceHistory,
};
