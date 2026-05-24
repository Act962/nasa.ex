import { listConversation } from "./list";
import { getConversation } from "./get";
import { createConversation } from "./create";
import { findConversationByPhone } from "./find-by-phone";
import { startConversationByPhone } from "./start-by-phone";
import { findChatByPhone } from "./find-chats";
import { blastInChatLink } from "./blast-in-chat-link";

export const conversationRouter = {
  list: listConversation,
  get: getConversation,
  create: createConversation,
  findByPhone: findConversationByPhone,
  startByPhone: startConversationByPhone,
  findChat: findChatByPhone,
  blastInChatLink,
};
