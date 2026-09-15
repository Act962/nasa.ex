"use client";

import { useState } from "react";
import { BellRing, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePaymentReminders } from "../../hooks/use-payment-reminders";
import { ReminderCreateDialog } from "./reminder-create-dialog";
import { ReminderListItem } from "./reminder-list-item";

// Lembretes que enviam o documento por WhatsApp/e-mail (spec 0017). Sem
// `entryId` lista os da organização; com `entryId`, só os do lançamento.

interface RemindersPanelProps {
  entryId?: string;
  title?: string;
  className?: string;
}

export function RemindersPanel({ entryId, title = "Lembretes", className }: RemindersPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data, isLoading } = usePaymentReminders({ entryId });
  const reminders = data?.reminders ?? [];

  return (
    <section className={cn("space-y-3 rounded-lg border p-4", className)}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
          {reminders.length > 0 && (
            <span className="text-xs text-muted-foreground">({reminders.length})</span>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-1 size-3.5" />
          Novo lembrete
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-md bg-muted/40" />
          <div className="h-14 animate-pulse rounded-md bg-muted/40" />
        </div>
      ) : reminders.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Nenhum lembrete. Agende o envio do boleto por WhatsApp ou e-mail.
        </p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((reminder) => (
            <ReminderListItem key={reminder.id} reminder={reminder} />
          ))}
        </ul>
      )}

      <ReminderCreateDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} entryId={entryId} />
    </section>
  );
}
