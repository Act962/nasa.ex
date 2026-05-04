import { Button } from "@/components/ui/button";
import { TrashIcon, CalendarIcon, ClockIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import dayjs from "dayjs";
import { RECURRENCE_LABELS } from "./data";
import { useListReminders, useDeleteReminder } from "../../hooks/use-remimber";

interface ReminderListTabProps {
  conversationId?: string;
  leadId?: string;
  trackingId?: string;
  actionId?: string;
}

export function ReminderListTab({
  conversationId,
  leadId,
  trackingId,
  actionId,
}: ReminderListTabProps) {
  const { data, isLoading } = useListReminders({
    conversationId,
    leadId,
    trackingId,
    actionId,
  });

  const deleteReminder = useDeleteReminder({
    conversationId,
    leadId,
    trackingId,
    actionId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-6" />
      </div>
    );
  }

  const reminders = data?.reminders || [];

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <CalendarIcon className="size-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-foreground">Nenhum lembrete</p>
        <p className="text-xs text-muted-foreground mt-1">
          {actionId
            ? "Você não tem lembretes ativos para este evento."
            : "Você não tem lembretes ativos para este lead."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto max-h-[400px] scroll-cols-tracking">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="flex items-start justify-between gap-4 p-3 border rounded-lg bg-card"
        >
          <div className="flex flex-col gap-1.5 overflow-hidden">
            <p className="text-sm font-medium leading-snug wrap-break-word">
              {reminder.message}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>
                  {reminder.nextRemindAt
                    ? dayjs(reminder.nextRemindAt).format("DD/MM/YYYY")
                    : "-"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClockIcon className="size-3.5" />
                <span>{reminder.remindTime}</span>
              </div>
              <div className="px-1.5 py-0.5 rounded-sm bg-muted text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {RECURRENCE_LABELS[reminder.recurrenceType]}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive shrink-0 size-8"
            disabled={deleteReminder.isPending}
            onClick={() => deleteReminder.mutate({ reminderId: reminder.id })}
          >
            <TrashIcon className="size-4" />
            <span className="sr-only">Remover</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
