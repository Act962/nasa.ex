import { listActionChat } from "./list";
import { createActionChatMessage } from "./create";
import { createActionChatFileMessage } from "./create-with-file";
import { editActionChatMessage } from "./edit";
import { deleteActionChatMessage } from "./delete";
import { markReadActionChat } from "./mark-read";
import { unreadCountsActionChat } from "./unread-counts";

export const actionChatRoutes = {
  list: listActionChat,
  create: createActionChatMessage,
  createWithFile: createActionChatFileMessage,
  edit: editActionChatMessage,
  delete: deleteActionChatMessage,
  markRead: markReadActionChat,
  unreadCounts: unreadCountsActionChat,
};
