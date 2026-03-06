import { listConversation } from "./list";
import { getConversation } from "./get";
import { createConversation } from "./create";

export const conversationRouter = {
  list: listConversation,
  get: getConversation,
  create: createConversation,
};
