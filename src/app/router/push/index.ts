import { subscribeToPush } from "./subscribe";
import { unsubscribeFromPush } from "./unsubscribe";
import { listMyPushSubscriptions } from "./list-mine";
import { sendTestPush } from "./send-test";

export const pushRouter = {
  subscribe: subscribeToPush,
  unsubscribe: unsubscribeFromPush,
  listMine: listMyPushSubscriptions,
  sendTest: sendTestPush,
};
