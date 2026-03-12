import { createAgenda } from "./create";
import { duplicateAgenda } from "./duplicate";
import { getManyAgendas } from "./get-many";
import { deleteAgenda } from "./delete";

export const agendaRouter = {
  create: createAgenda,
  getMany: getManyAgendas,
  duplicate: duplicateAgenda,
  delete: deleteAgenda,
};
