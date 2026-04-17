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
import { getPublicAppointment } from "./public/get-appointment";
import { cancelPublicAppointment } from "./public/cancel-appointment";
import { reschedulePublicAppointment } from "./public/reschedule-appointment";
import { createAppointment } from "./appointments/create";
import { createAdminAppointment } from "./appointments/create-admin";
import { getAppointmentsByTracking } from "./appointments/get-appointments-by-tracking";
import { getAppointment } from "./appointments/get";
import { cancelAppointment } from "./appointments/cancel";
import { rescheduleAppointment } from "./appointments/reschedule";
import { getAppointmentsByOrg } from "./appointments/get-appointments-by-org";
import { toggleDateOverride } from "./date-overrides/toggle";
import { getManyDateOverrides } from "./date-overrides/get-many";
import { getAgendasByTracking } from "./get-by-tracking";
import { getManyDateAvailabilities } from "./date-availabilities/get-many";
import { upsertDateAvailability } from "./date-availabilities/upsert";
import { deleteDateAvailability } from "./date-availabilities/delete";
import { createDateAvailabilitySlot } from "./date-availabilities/slots/create";
import { updateDateAvailabilitySlot } from "./date-availabilities/slots/update";
import { deleteDateAvailabilitySlot } from "./date-availabilities/slots/delete";

export const agendaRouter = {
  create: createAgenda,
  get: getAgenda,
  getMany: getManyAgendas,
  getByTracking: getAgendasByTracking,
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
      get: getPublicAppointment,
      cancel: cancelPublicAppointment,
      reschedule: reschedulePublicAppointment,
    },
  },
  appointments: {
    get: getAppointment,
    cancel: cancelAppointment,
    getManyByTracking: getAppointmentsByTracking,
    getManyByOrg: getAppointmentsByOrg,
    createAdmin: createAdminAppointment,
    reschedule: rescheduleAppointment,
  },
  dateOverrides: {
    toggle: toggleDateOverride,
    getMany: getManyDateOverrides,
  },
  dateAvailabilities: {
    getMany: getManyDateAvailabilities,
    upsert: upsertDateAvailability,
    delete: deleteDateAvailability,
    slots: {
      create: createDateAvailabilitySlot,
      update: updateDateAvailabilitySlot,
      delete: deleteDateAvailabilitySlot,
    },
  },
};
