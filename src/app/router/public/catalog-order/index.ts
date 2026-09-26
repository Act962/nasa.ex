import { getPublicCatalogOrder } from "./get";
import { listPublicCatalogOrderMessages } from "./list-messages";
import { sendPublicCatalogOrderMessage } from "./send-message";

export const publicCatalogOrderRouter = {
  get: getPublicCatalogOrder,
  listMessages: listPublicCatalogOrderMessages,
  sendMessage: sendPublicCatalogOrderMessage,
};
