import { createReminder } from "./create";
import { listReminders } from "./list";
import { deleteReminder } from "./delete";
import { listReminderOccurrences } from "./list-occurrences";

export const reminderRouter = {
  create: createReminder,
  list: listReminders,
  delete: deleteReminder,
  occurrences: listReminderOccurrences,
};
