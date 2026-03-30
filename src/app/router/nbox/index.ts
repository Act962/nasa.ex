import { getFolders } from "./get-folders";
import { createFolder } from "./create-folder";
import { updateFolder } from "./update-folder";
import { deleteFolder } from "./delete-folder";
import { getItems } from "./get-items";
import { createItem } from "./create-item";
import { updateItem } from "./update-item";
import { deleteItem } from "./delete-item";
import { getStorage } from "./get-storage";

export const nboxRouter = {
  folders: {
    getMany: getFolders,
    create: createFolder,
    update: updateFolder,
    delete: deleteFolder,
  },
  items: {
    getMany: getItems,
    create: createItem,
    update: updateItem,
    delete: deleteItem,
  },
  getStorage,
};
