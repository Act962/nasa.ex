import { listPartners } from "./list";
import { getPartner } from "./get";
import { promoteUser, searchUsersToPromote } from "./promote-user";
import {
  attachOrganization,
  detachOrganization,
  searchOrgsToAttach,
} from "./attach-organization";
import { suspendPartner, reactivatePartner, recalcTier } from "./status";
import { getSettings, updateSettings } from "./settings";
import { listPendingPayouts, markPayoutPaid } from "./payouts";
import {
  listTermsVersions,
  createTermsVersion,
  publishTermsVersion,
  listAcceptancesByPartner,
} from "./terms";
import { listReferralsByPartner } from "./referrals";

export const adminPartnersRouter = {
  list: listPartners,
  get: getPartner,
  promoteUser,
  searchUsersToPromote,
  attachOrganization,
  detachOrganization,
  searchOrgsToAttach,
  suspend: suspendPartner,
  reactivate: reactivatePartner,
  recalcTier,
  getSettings,
  updateSettings,
  listPendingPayouts,
  markPayoutPaid,
  listTermsVersions,
  createTermsVersion,
  publishTermsVersion,
  listAcceptancesByPartner,
  listReferralsByPartner,
};
