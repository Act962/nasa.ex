import { getPublicCatalogOrder } from "./get";
import { listPublicCatalogOrderMessages } from "./list-messages";
import { sendPublicCatalogOrderMessage } from "./send-message";
import { getPublicStarFriends, requestPublicStarFriendsRedemption } from "./star-friends";

export const publicCatalogOrderRouter = {
  get: getPublicCatalogOrder,
  listMessages: listPublicCatalogOrderMessages,
  sendMessage: sendPublicCatalogOrderMessage,
  starFriends: getPublicStarFriends,
  requestRedemption: requestPublicStarFriendsRedemption,
};
