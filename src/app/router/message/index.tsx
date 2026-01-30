import { listMessage } from "./list";
import { createTextMessage } from "./create";

export const messageRouter = {
  list: listMessage,
  create: createTextMessage,
};
