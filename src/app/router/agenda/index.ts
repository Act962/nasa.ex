import { createAgenda } from "./create";
import { duplicateAgenda } from "./duplicate";
import { getManyAgendas } from "./get-many";
import { deleteAgenda } from "./delete";
import { getAgenda } from "./get";
import { toggleActiveAgenda } from "./toggle-active";
import { getAvailabilities } from "./get-availabilities";
import { getManyTimeSlots } from "./timeslots/get-many";
import { toggleActiveAvailability } from "./availabilities/toggle-active";
import { deleteTimeSlot } from "./timeslots/delete";
import { createTimeSlot } from "./timeslots/create";
import { updateTimeSlot } from "./timeslots/update";
import { updateAgenda } from "./update";
import { getPublicAgenda } from "./public/get";
import { getPublicAgendaTimeSlots } from "./public/get-timeslots";
import { createAppointment } from "./appointments/create";
import { getAppointmentsByTracking } from "./appointments/get-appointments-by-tracking";
import { getAppointment } from "./appointments/get";

export const agendaRouter = {
  create: createAgenda,
  get: getAgenda,
  getMany: getManyAgendas,
  duplicate: duplicateAgenda,
  delete: deleteAgenda,
  update: updateAgenda,
  toggleActive: toggleActiveAgenda,
  getAvailabilities: getAvailabilities,
  timeslots: {
    getMany: getManyTimeSlots,
    delete: deleteTimeSlot,
    create: createTimeSlot,
    update: updateTimeSlot,
  },
  availabilities: {
    toggleActive: toggleActiveAvailability,
  },
  public: {
    get: getPublicAgenda,
    getTimeSlots: getPublicAgendaTimeSlots,
    appointment: {
      create: createAppointment,
    },
  },
  appointments: {
    get: getAppointment,
    getManyByTracking: getAppointmentsByTracking,
  },
};
