import { listMessage } from "./list";
import { createTextMessage } from "./create";
import { createMessageWithImage } from "./create-with-image";
import { createMessageWithFile } from "./create-with-file";
import { createMessageWithAudio } from "./create-audio";
import { createButtonsMessage } from "./create-with-buttons";
import { createLocationMessage } from "./create-with-location";
import { deleteMessageHandler } from "./delet-message";
import { editMessageHandler } from "./edit";
import { markReadMessageHandler } from "./mark-read";
import { forwardMessageHandler } from "./forward";

export const messageRouter = {
  list: listMessage,
  create: createTextMessage,
  createWithImage: createMessageWithImage,
  createWithFile: createMessageWithFile,
  createAudio: createMessageWithAudio,
  createWithButtons: createButtonsMessage,
  createLocation: createLocationMessage,
  delete: deleteMessageHandler,
  edit: editMessageHandler,
  markRead: markReadMessageHandler,
  forward: forwardMessageHandler,
};
