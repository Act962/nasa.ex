import { listMessage } from "./list";
import { createTextMessage } from "./create";
import { createMessageWithImage } from "./create-with-image";
import { createMessageWithFile } from "./create-with-file";
import { createMessageWithAudio } from "./create-audio";
import { deleteMessageHandler } from "./delet-message";
import { editMessageHandler } from "./edit";
import { markReadMessageHandler } from "./mark-read";

export const messageRouter = {
  list: listMessage,
  create: createTextMessage,
  createWithImage: createMessageWithImage,
  createWithFile: createMessageWithFile,
  createAudio: createMessageWithAudio,
  delete: deleteMessageHandler,
  edit: editMessageHandler,
  markRead: markReadMessageHandler,
};
