"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrashIcon, CalendarIcon, ClockIcon, PhoneIcon, BellIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import dayjs from "dayjs";
import { RECURRENCE_LABELS } from "./data";
import { useListReminders, useDeleteReminder } from "../../hooks/use-remimber";
import { ReminderOccurrencesPopover } from "./reminder-occurrences-popover";
import { useState, useEffect } from "react";
import { phoneMaskFull } from "@/utils/format-phone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReminderListTabProps {
  conversationId?: string;
  leadId?: string;
  trackingId?: string;
  actionId?: string;
  leadName?: string;
}

export function ReminderListTab({
  conversationId,
  leadId,
  trackingId,
  actionId,
  leadName,
}: ReminderListTabProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

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

  // Reset input when dialog closes
  useEffect(() => {
    if (!pendingDeleteId) setConfirmInput("");
  }, [pendingDeleteId]);

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

  const pendingReminder = reminders.find((r) => r.id === pendingDeleteId);

  // First 2 words of lead name for confirmation
  const confirmTarget = leadName?.split(" ").slice(0, 2).join(" ") ?? "";
  const isConfirmed =
    confirmTarget.length > 0
      ? confirmInput.trim().toLowerCase() === confirmTarget.toLowerCase()
      : confirmInput.trim() === "Confirmar";

  return (
    <>
      <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto max-h-[400px] scroll-cols-tracking">
        {reminders.map((reminder) => {
          const isDone = !reminder.isActive;
          return (
          <div
            key={reminder.id}
            className={`flex items-start justify-between gap-4 p-3 border rounded-lg bg-card ${
              isDone
                ? "border-success/40 opacity-80"
                : reminder.nextRemindAt && dayjs(reminder.nextRemindAt).isAfter(dayjs())
                  ? "border-warning/40"
                  : ""
            }`}
          >
            <div className="flex flex-col gap-1.5 overflow-hidden">
              <div className="flex items-start gap-1.5">
                {isDone && (
                  <CheckCircle2Icon
                    className="size-4 text-success shrink-0 mt-0.5"
                    aria-label="Lembrete concluído"
                  />
                )}
                <p
                  className={`text-sm font-medium leading-snug wrap-break-word ${
                    isDone ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {reminder.message}
                </p>
              </div>
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

              {reminder.nextRemindAt && dayjs(reminder.nextRemindAt).isAfter(dayjs()) && (
                <div className="flex items-center gap-1.5 mt-1.5 w-fit rounded-md bg-warning/10 border border-warning/30 px-2 py-1">
                  <BellIcon className="size-3 text-warning-foreground shrink-0" />
                  <span className="text-[11px] font-medium text-warning-foreground">
                    Próximo envio:{" "}
                    {dayjs(reminder.nextRemindAt).format("DD/MM [às] HH:mm")}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ReminderOccurrencesPopover reminderId={reminder.id} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-8"
                disabled={deleteReminder.isPending}
                onClick={() => setPendingDeleteId(reminder.id)}
              >
                <TrashIcon className="size-4" />
                <span className="sr-only">Remover</span>
              </Button>
            </div>
          </div>
          );
        })}
      </div>

      <Dialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover lembrete</DialogTitle>
            <DialogDescription>
              Deseja realmente remover o lembrete{" "}
              {pendingReminder?.message ? (
                <strong className="text-foreground">
                  &quot;{pendingReminder.message}&quot;
                </strong>
              ) : (
                "selecionado"
              )}
              ? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {pendingReminder?.notifyPhone && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
              <span className="text-xs text-muted-foreground block mb-1">
                Contato
              </span>
              <div className="flex items-center gap-2 text-sm font-medium">
                <PhoneIcon className="size-3.5 text-muted-foreground" />
                <span>{phoneMaskFull(pendingReminder.notifyPhone)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirmDelete">
              {confirmTarget
                ? <>Digite <strong>{confirmTarget}</strong> para confirmar</>
                : 'Digite "Confirmar" para confirmar'}
            </Label>
            <Input
              id="confirmDelete"
              autoComplete="off"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmTarget || "Confirmar"}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDeleteId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!isConfirmed || deleteReminder.isPending}
              onClick={() => {
                if (pendingDeleteId) {
                  deleteReminder.mutate({ reminderId: pendingDeleteId });
                  setPendingDeleteId(null);
                }
              }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
