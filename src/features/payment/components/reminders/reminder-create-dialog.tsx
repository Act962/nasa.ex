"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describePaymentError } from "../../lib/describe-error";
import { useEntryAttachments, usePaymentAttachments } from "../../hooks/use-payment-attachments";
import { useCreatePaymentReminder } from "../../hooks/use-payment-reminders";
import {
  PAYMENT_REMINDER_CHANNELS,
  REMINDER_CHANNEL_LABELS,
  REMINDER_MESSAGE_MAX_LENGTH,
  type PaymentReminderChannelValue,
  type ReminderRecipient,
} from "../../schemas/reminders";
import { ReminderRecipientsField } from "./reminder-recipients-field";

const NO_ATTACHMENT_VALUE = "__none__";
const AUTO_ATTACHMENT_VALUE = "__auto__";
const DEFAULT_LEAD_TIME_MS = 60 * 60 * 1000;

function toLocalDateTimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface ReminderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId?: string;
}

export function ReminderCreateDialog({ open, onOpenChange, entryId }: ReminderCreateDialogProps) {
  const [remindAtLocal, setRemindAtLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + DEFAULT_LEAD_TIME_MS)),
  );
  const [channels, setChannels] = useState<PaymentReminderChannelValue[]>(["WHATSAPP", "EMAIL"]);
  const [recipients, setRecipients] = useState<ReminderRecipient[]>([]);
  const [message, setMessage] = useState("");
  const [notifyCreator, setNotifyCreator] = useState(true);
  const [attachmentChoice, setAttachmentChoice] = useState(entryId ? AUTO_ATTACHMENT_VALUE : NO_ATTACHMENT_VALUE);

  const entryAttachments = useEntryAttachments(entryId);
  const organizationAttachments = usePaymentAttachments({ perPage: 50 });
  const attachments = entryId
    ? (entryAttachments.data?.attachments ?? [])
    : (organizationAttachments.data?.attachments ?? []);

  const createReminder = useCreatePaymentReminder();

  function resetForm() {
    setRemindAtLocal(toLocalDateTimeInputValue(new Date(Date.now() + DEFAULT_LEAD_TIME_MS)));
    setChannels(["WHATSAPP", "EMAIL"]);
    setRecipients([]);
    setMessage("");
    setNotifyCreator(true);
    setAttachmentChoice(entryId ? AUTO_ATTACHMENT_VALUE : NO_ATTACHMENT_VALUE);
  }

  function toggleChannel(channel: PaymentReminderChannelValue, isChecked: boolean) {
    setChannels((current) =>
      isChecked ? Array.from(new Set([...current, channel])) : current.filter((item) => item !== channel),
    );
  }

  function handleSubmit() {
    const remindAt = new Date(remindAtLocal);
    if (Number.isNaN(remindAt.getTime())) {
      toast.error("Informe a data e a hora do lembrete");
      return;
    }
    const isExplicitAttachment =
      attachmentChoice !== NO_ATTACHMENT_VALUE && attachmentChoice !== AUTO_ATTACHMENT_VALUE;

    createReminder.mutate(
      {
        entryId,
        attachmentId: isExplicitAttachment ? attachmentChoice : undefined,
        remindAt: remindAt.toISOString(),
        channels,
        recipients,
        message: message.trim() || undefined,
        notifyCreator,
      },
      {
        onSuccess: () => {
          toast.success("Lembrete agendado");
          resetForm();
          onOpenChange(false);
        },
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível agendar o lembrete")),
      },
    );
  }

  const isSubmitDisabled = channels.length === 0 || recipients.length === 0 || createReminder.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lembrete</DialogTitle>
          <DialogDescription>
            Envia a mensagem e o documento na data escolhida. Cada envio consome 1★.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reminder-remind-at">Quando enviar</Label>
            <Input
              id="reminder-remind-at"
              type="datetime-local"
              value={remindAtLocal}
              onChange={(event) => setRemindAtLocal(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Canais</Label>
            <div className="flex gap-4">
              {PAYMENT_REMINDER_CHANNELS.map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={channels.includes(channel)}
                    onCheckedChange={(checked) => toggleChannel(channel, checked === true)}
                  />
                  {REMINDER_CHANNEL_LABELS[channel]}
                </label>
              ))}
            </div>
          </div>

          <ReminderRecipientsField recipients={recipients} onChange={setRecipients} />

          <div className="space-y-1.5">
            <Label>Documento</Label>
            <Select value={attachmentChoice} onValueChange={setAttachmentChoice}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o documento" />
              </SelectTrigger>
              <SelectContent>
                {entryId && (
                  <SelectItem value={AUTO_ATTACHMENT_VALUE}>Mais recente do lançamento</SelectItem>
                )}
                <SelectItem value={NO_ATTACHMENT_VALUE}>Sem documento</SelectItem>
                {attachments.map((attachment) => (
                  <SelectItem key={attachment.id} value={attachment.id}>
                    {attachment.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reminder-message">Mensagem</Label>
            <Textarea
              id="reminder-message"
              rows={3}
              maxLength={REMINDER_MESSAGE_MAX_LENGTH}
              placeholder="Opcional — sem texto, envio descrição, valor e vencimento do lançamento."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notifyCreator} onCheckedChange={(checked) => setNotifyCreator(checked === true)} />
            Me avisar quando enviar
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={isSubmitDisabled} onClick={handleSubmit}>
            {createReminder.isPending ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
