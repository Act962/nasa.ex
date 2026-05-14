import { listConversation } from "./list";
import { getConversation } from "./get";
import { createConversation } from "./create";
import { findConversationByPhone } from "./find-by-phone";
import { startConversationByPhone } from "./start-by-phone";

export const conversationRouter = {
  list: listConversation,
  get: getConversation,
  create: createConversation,
  findByPhone: findConversationByPhone,
  startByPhone: startConversationByPhone,
};
