"use client";

import { useState } from "react";
import { ChevronDown, FileText, Mail, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describePaymentError } from "../../lib/describe-error";
import { useCancelPaymentReminder } from "../../hooks/use-payment-reminders";
import {
  REMINDER_CHANNEL_LABELS,
  REMINDER_STATUS_LABELS,
  type PaymentReminderChannelValue,
  type PaymentReminderStatusValue,
  type ReminderDeliveryLogItem,
  type ReminderRecipient,
} from "../../schemas/reminders";

export interface ReminderListItemData {
  id: string;
  remindAt: Date;
  status: PaymentReminderStatusValue;
  channels: PaymentReminderChannelValue[];
  recipients: ReminderRecipient[];
  message: string;
  deliveryLog: ReminderDeliveryLogItem[];
  entry: { description: string; amount: number } | null;
  attachment: { fileName: string } | null;
}

const STATUS_BADGE_CLASSES: Record<PaymentReminderStatusValue, string> = {
  SCHEDULED: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  SENT: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  PARTIAL: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  FAILED: "border-red-500/40 text-red-600 dark:text-red-400",
  SKIPPED: "border-muted-foreground/30 text-muted-foreground",
  CANCELLED: "border-muted-foreground/30 text-muted-foreground",
};

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ReminderListItem({ reminder }: { reminder: ReminderListItemData }) {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const cancelReminder = useCancelPaymentReminder();

  function handleCancel() {
    cancelReminder.mutate(
      { reminderId: reminder.id },
      {
        onSuccess: () => toast.success("Lembrete cancelado"),
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível cancelar o lembrete")),
      },
    );
  }

  return (
    <li className="rounded-md border px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">{formatDateTime(reminder.remindAt)}</span>
            <Badge variant="outline" className={cn("text-[10px]", STATUS_BADGE_CLASSES[reminder.status])}>
              {REMINDER_STATUS_LABELS[reminder.status]}
            </Badge>
            {reminder.channels.map((channel) => (
              <span key={channel} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                {channel === "WHATSAPP" ? <MessageCircle className="size-3" /> : <Mail className="size-3" />}
                {REMINDER_CHANNEL_LABELS[channel]}
              </span>
            ))}
          </div>

          <p className="truncate text-xs text-muted-foreground">
            Para {reminder.recipients.map((recipient) => recipient.name).join(", ")}
          </p>

          {reminder.entry && (
            <p className="truncate text-[11px] text-muted-foreground">
              {reminder.entry.description} · {formatCents(reminder.entry.amount)}
            </p>
          )}

          {reminder.attachment && (
            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <FileText className="size-3 shrink-0" />
              <span className="truncate" title={reminder.attachment.fileName}>
                {reminder.attachment.fileName}
              </span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {reminder.deliveryLog.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              title="Detalhes do envio"
              onClick={() => setIsLogOpen((isOpen) => !isOpen)}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", isLogOpen && "rotate-180")} />
            </Button>
          )}
          {reminder.status === "SCHEDULED" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              title="Cancelar lembrete"
              disabled={cancelReminder.isPending}
              onClick={handleCancel}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {isLogOpen && (
        <ul className="mt-2 space-y-1 border-t pt-2">
          {reminder.deliveryLog.map((delivery, index) => (
            <li key={`${delivery.recipientName}-${delivery.channel}-${index}`} className="text-[11px]">
              <span className="font-medium">{delivery.recipientName}</span>
              {" · "}
              {REMINDER_CHANNEL_LABELS[delivery.channel]}
              {" · "}
              <span
                className={cn(
                  delivery.status === "SENT" && "text-emerald-600 dark:text-emerald-400",
                  delivery.status === "FAILED" && "text-red-600 dark:text-red-400",
                )}
              >
                {delivery.status === "SENT" ? "enviado" : delivery.status === "FAILED" ? "falhou" : "pulado"}
              </span>
              {delivery.reason && <span className="text-muted-foreground"> ({delivery.reason})</span>}
              {delivery.starsCharged > 0 && <span className="text-muted-foreground"> · {delivery.starsCharged}★</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
