import { listConversation } from "./list";
import { getConversation } from "./get";

export const conversationRouter = {
  list: listConversation,
  get: getConversation,
};
