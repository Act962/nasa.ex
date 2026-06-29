import { listStickers } from "./list";
import { createSticker } from "./create";
import { deleteSticker } from "./delete";

export const stickersRouter = {
  list: listStickers,
  create: createSticker,
  delete: deleteSticker,
};
