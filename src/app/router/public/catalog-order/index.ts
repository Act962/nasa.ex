import { getPublicCatalogOrder } from "./get";
import { listPublicCatalogOrderMessages } from "./list-messages";
import { payPublicCatalogOrderWithPix } from "./pay-with-pix";
import { sendPublicCatalogOrderMessage } from "./send-message";
import { getPublicStarFriends, listPublicCustomerOrders, requestPublicStarFriendsRedemption } from "./star-friends";

export const publicCatalogOrderRouter = {
  get: getPublicCatalogOrder,
  listMessages: listPublicCatalogOrderMessages,
  sendMessage: sendPublicCatalogOrderMessage,
  payWithPix: payPublicCatalogOrderWithPix,
  starFriends: getPublicStarFriends,
  requestRedemption: requestPublicStarFriendsRedemption,
  customerOrders: listPublicCustomerOrders,
};
