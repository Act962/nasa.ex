import { connectInstanceUazapi } from "./conect";
import { createInstanceUazapi } from "./create";
import { deleteInstanceUazapi } from "./delet";
import { disconnectInstanceUazapi } from "./disconect";
import { getIntegration } from "./list";
import { newNasaIntegration } from "./new-nasa-total";
import { newNasaIntegrationPartial } from "./new-nasa-partial";

export const integrationsRouter = {
  create: createInstanceUazapi,
  connect: connectInstanceUazapi,
  disconnect: disconnectInstanceUazapi,
  get: getIntegration,
  delete: deleteInstanceUazapi,
  newNasa: newNasaIntegration,
  newNasaPartial: newNasaIntegrationPartial,
};
