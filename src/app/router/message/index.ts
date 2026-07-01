import { listMessage } from "./list";
import { createTextMessage } from "./create";
import { createTemplateMessage } from "./create-template";
import { createMessageWithImage } from "./create-with-image";
import { createMessageWithSticker } from "./create-with-sticker";
import { createMessageWithFile } from "./create-with-file";
import { createMessageWithAudio } from "./create-audio";
import { createButtonsMessage } from "./create-with-buttons";
import { createLocationMessage } from "./create-with-location";
import { createContactMessage } from "./create-with-contact";
import { deleteMessageHandler } from "./delet-message";
import { syncFromUazapi } from "./sync-from-uazapi";
import { editMessageHandler } from "./edit";
import { markReadMessageHandler } from "./mark-read";
import { forwardMessageHandler } from "./forward";
import { getCustomerWindowState } from "./customer-window";

export const messageRouter = {
  list: listMessage,
  create: createTextMessage,
  createTemplate: createTemplateMessage,
  createWithImage: createMessageWithImage,
  createWithSticker: createMessageWithSticker,
  createWithFile: createMessageWithFile,
  createAudio: createMessageWithAudio,
  createWithButtons: createButtonsMessage,
  createLocation: createLocationMessage,
  createContact: createContactMessage,
  syncFromUazapi: syncFromUazapi,
  delete: deleteMessageHandler,
  edit: editMessageHandler,
  markRead: markReadMessageHandler,
  forward: forwardMessageHandler,
  customerWindow: getCustomerWindowState,
};
