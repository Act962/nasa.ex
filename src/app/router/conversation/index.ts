import { listConversation } from "./list";
import { getConversation } from "./get";
import { createConversation } from "./create";
import { findConversationByPhone } from "./find-by-phone";
import { startConversationByPhone } from "./start-by-phone";
import { findChatByPhone } from "./find-chats";
import { importExistingChats } from "./import-existing-chats";
import { startFromGroupParticipant } from "./start-from-group-participant";
import { syncNowConversation } from "./sync-now";

export const conversationRouter = {
  list: listConversation,
  get: getConversation,
  create: createConversation,
  findByPhone: findConversationByPhone,
  startByPhone: startConversationByPhone,
  findChat: findChatByPhone,
  importExistingChats,
  startFromGroupParticipant,
  syncNow: syncNowConversation,
};
