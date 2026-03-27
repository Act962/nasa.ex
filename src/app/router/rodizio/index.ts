import { createTrackingConsultant } from "./create";
import { deleteTrackingConsultant } from "./delete";
import { finishLead } from "./finish-lead";
import { listTrackingConsultants } from "./list";
import { listUsersWithoutConsultants } from "./list-users-without-consultants";
import { newLead } from "./new-lead";
import { updateTrackingConsultant } from "./update";

export const rodizioRouter = {
  create: createTrackingConsultant,
  list: listTrackingConsultants,
  update: updateTrackingConsultant,
  delete: deleteTrackingConsultant,
  listUsersWithoutConsultants: listUsersWithoutConsultants,
  newLead,
  finishLead,
};
