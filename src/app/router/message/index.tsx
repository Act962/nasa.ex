import { listMessage } from "./list";
import { createTextMessage } from "./create";
import { createMessageWithImage } from "./create-with-image";

export const messageRouter = {
  list: listMessage,
  create: createTextMessage,
  createWithImage: createMessageWithImage,
};
