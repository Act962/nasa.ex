import { getStarFriendsOverview } from "./overview";
import { installStarFriends } from "./install";
import { upsertStarFriendsProgram, upsertStarFriendsTiers } from "./program";
import { deleteStarFriendsReward, listStarFriendsRewards, upsertStarFriendsReward } from "./rewards";
import { listStarFriendsMembers } from "./members";
import { listStarFriendsHistory } from "./history";
import {
  decideStarFriendsRedemption,
  listStarFriendsRedemptions,
  requestStarFriendsRedemption,
} from "./redemptions";
import { adjustStarFriendsStars, getStarFriendsByLead } from "./by-lead";
import {
  drawStarFriendsCampaign,
  exportStarFriendsCampaignNumbers,
  getStarFriendsCampaign,
  listStarFriendsCampaignReceipts,
  reviewStarFriendsCampaignReceipt,
  sweepStarFriendsCampaign,
  upsertStarFriendsCampaign,
} from "./campaign";

export const starFriendsRouter = {
  overview: getStarFriendsOverview,
  install: installStarFriends,
  upsertProgram: upsertStarFriendsProgram,
  upsertTiers: upsertStarFriendsTiers,
  rewards: { list: listStarFriendsRewards, upsert: upsertStarFriendsReward, delete: deleteStarFriendsReward },
  members: { list: listStarFriendsMembers },
  history: { list: listStarFriendsHistory },
  redemptions: {
    list: listStarFriendsRedemptions,
    request: requestStarFriendsRedemption,
    decide: decideStarFriendsRedemption,
  },
  byLead: getStarFriendsByLead,
  adjust: adjustStarFriendsStars,
  campaign: {
    get: getStarFriendsCampaign,
    upsert: upsertStarFriendsCampaign,
    receipts: listStarFriendsCampaignReceipts,
    reviewReceipt: reviewStarFriendsCampaignReceipt,
    exportNumbers: exportStarFriendsCampaignNumbers,
    sweep: sweepStarFriendsCampaign,
    draw: drawStarFriendsCampaign,
  },
};
