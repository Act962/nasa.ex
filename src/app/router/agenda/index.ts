import { createAgenda } from "./create";
import { duplicateAgenda } from "./duplicate";
import { getManyAgendas } from "./get-many";
import { deleteAgenda } from "./delete";
import { getAgenda } from "./get";
import { toggleActiveAgenda } from "./toggle-active";
import { getAvailabilities } from "./get-availabilities";

export const agendaRouter = {
  create: createAgenda,
  get: getAgenda,
  getMany: getManyAgendas,
  duplicate: duplicateAgenda,
  delete: deleteAgenda,
  toggleActive: toggleActiveAgenda,
  getAvailabilities: getAvailabilities,
};
