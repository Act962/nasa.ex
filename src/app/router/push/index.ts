import { subscribeToPush } from "./subscribe";
import { unsubscribeFromPush } from "./unsubscribe";
import { listMyPushSubscriptions } from "./list-mine";

export const pushRouter = {
  subscribe: subscribeToPush,
  unsubscribe: unsubscribeFromPush,
  listMine: listMyPushSubscriptions,
};
