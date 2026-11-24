import { getFolders } from "./get-folders";
import { createFolder } from "./create-folder";
import { updateFolder } from "./update-folder";
import { deleteFolder } from "./delete-folder";
import { getItems } from "./get-items";
import { createItem } from "./create-item";
import { updateItem } from "./update-item";
import { deleteItem } from "./delete-item";
import { toggleItemPublic } from "./toggle-item-public";
import { getStorage } from "./get-storage";
import { completeUpload, startUpload } from "./uploads";
import { createTransfer, listTransfers, updateTransfer } from "./transfers";
import {
  completePublicUpload,
  createUploadLink,
  deletePublicUpload,
  finishPublicUpload,
  getPublicUploadLink,
  startPublicUpload,
  updateUploadLink,
} from "./upload-links";

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
    togglePublic: toggleItemPublic,
  },
  getStorage,
  uploads: {
    start: startUpload,
    complete: completeUpload,
  },
  transfers: {
    create: createTransfer,
    getMany: listTransfers,
    update: updateTransfer,
  },
  uploadLinks: {
    create: createUploadLink,
    update: updateUploadLink,
    public: {
      get: getPublicUploadLink,
      startUpload: startPublicUpload,
      completeUpload: completePublicUpload,
      deleteUpload: deletePublicUpload,
      finish: finishPublicUpload,
    },
  },
};
