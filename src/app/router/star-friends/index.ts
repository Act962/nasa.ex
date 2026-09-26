import { getStarFriendsOverview } from "./overview";
import { installStarFriends } from "./install";
import { upsertStarFriendsProgram } from "./program";
import { listStarFriendsRewards, upsertStarFriendsReward } from "./rewards";
import { listStarFriendsMembers } from "./members";
import { listStarFriendsHistory } from "./history";
import {
  decideStarFriendsRedemption,
  listStarFriendsRedemptions,
  requestStarFriendsRedemption,
} from "./redemptions";
import { adjustStarFriendsStars, getStarFriendsByLead } from "./by-lead";

export const starFriendsRouter = {
  overview: getStarFriendsOverview,
  install: installStarFriends,
  upsertProgram: upsertStarFriendsProgram,
  rewards: { list: listStarFriendsRewards, upsert: upsertStarFriendsReward },
  members: { list: listStarFriendsMembers },
  history: { list: listStarFriendsHistory },
  redemptions: {
    list: listStarFriendsRedemptions,
    request: requestStarFriendsRedemption,
    decide: decideStarFriendsRedemption,
  },
  byLead: getStarFriendsByLead,
  adjust: adjustStarFriendsStars,
};
