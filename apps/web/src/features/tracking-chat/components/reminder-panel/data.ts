import { ReminderRecurrenceType } from "@/generated/prisma/enums";

export const RECURRENCE_LABELS: Record<ReminderRecurrenceType, string> = {
  [ReminderRecurrenceType.ONCE]: "Único",
  [ReminderRecurrenceType.WEEKLY]: "Semanal",
  [ReminderRecurrenceType.BIWEEKLY]: "Quinzenal",
  [ReminderRecurrenceType.MONTHLY]: "Mensal",
};
