import { listMessage } from "./list";
import { createTextMessage } from "./create";
import { createMessageWithImage } from "./create-with-image";
import { createMessageWithFile } from "./create-with-file";

export const messageRouter = {
  list: listMessage,
  create: createTextMessage,
  createWithImage: createMessageWithImage,
  createWithFile: createMessageWithFile,
};
