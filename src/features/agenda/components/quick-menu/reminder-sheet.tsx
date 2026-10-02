"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSaveLeadTrigger } from "@/features/leads/hooks/use-lead-triggers";
import { LEAD_NAME_PLACEHOLDER, hasLeadNamePlaceholder } from "@/features/leads/lib/triggers/templates";
import { QuickMenuEmpty, QuickMenuSheet } from "./quick-menu-sheet";
import { formatAppointmentWhen, upcomingAppointmentsWithLead } from "./upcoming-appointments";
import type { QuickMenuAppointment } from "./quick-menu-types";

/** Lembrete = Gatilho do lead: manda o WhatsApp para o lead um tempo antes do compromisso (spec 0038). */

// "Retorno combinado" é o gatilho de data marcada; o lembrete do compromisso ocupa esse card do lead.
const REMINDER_TRIGGER_TEMPLATE = "SCHEDULED_RETURN" as const;
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const OFFSET_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hora" },
  { minutes: 180, label: "3 horas" },
  { minutes: 1440, label: "1 dia" },
];

function buildDefaultMessage(appointment: QuickMenuAppointment): string {
  const startsAt = dayjs(appointment.startsAt);
  const whenLabel = startsAt.isSame(dayjs(), "day") ? "hoje" : `no dia ${startsAt.format("DD/MM")}`;
  return `Oi, ${LEAD_NAME_PLACEHOLDER}! Passando para lembrar do nosso compromisso ${whenLabel} às ${startsAt.format("HH:mm")}. Até já!`;
}

export function ReminderSheet({
  open,
  onOpenChange,
  appointments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: QuickMenuAppointment[];
}) {
  const upcomingAppointments = upcomingAppointmentsWithLead(appointments).filter((appointment) => appointment.lead?.phone);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [offsetMinutes, setOffsetMinutes] = useState(60);
  const [messageDraft, setMessageDraft] = useState<string | null>(null);

  const selectedAppointment =
    upcomingAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? upcomingAppointments[0];
  const saveLeadTrigger = useSaveLeadTrigger(selectedAppointment?.lead?.id ?? "");
  const message = messageDraft ?? (selectedAppointment ? buildDefaultMessage(selectedAppointment) : "");

  const createTrigger = () => {
    if (!selectedAppointment?.lead) return;
    const sendAt = dayjs(selectedAppointment.startsAt).subtract(offsetMinutes, "minute");
    if (!sendAt.isAfter(dayjs())) {
      toast.error("Esse horário de aviso já passou. Escolha um tempo menor.");
      return;
    }
    if (!hasLeadNamePlaceholder(message)) {
      toast.error(`A mensagem precisa ter ${LEAD_NAME_PLACEHOLDER} — é onde entra o nome do lead.`);
      return;
    }
    saveLeadTrigger.mutate(
      {
        leadId: selectedAppointment.lead.id,
        template: REMINDER_TRIGGER_TEMPLATE,
        message,
        isActive: true,
        scheduledAt: sendAt.toISOString(),
        // Janela aberta o dia todo: o aviso sai exatamente no horário escolhido.
        windowStart: "00:00",
        windowEnd: "23:59",
        weekdays: ALL_WEEKDAYS,
        skipWhenInService: false,
        repeatEveryDays: null,
        maxRepetitions: 1,
        tagIds: [],
      },
      {
        onSuccess: () => {
          toast.success(`Gatilho criado! ${selectedAppointment.lead?.name.split(" ")[0]} recebe o aviso ${sendAt.format("DD/MM [às] HH:mm")}.`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message || "Não consegui criar o gatilho agora."),
      },
    );
  };

  return (
    <QuickMenuSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={<AlarmClock className="text-warning" />}
      title="Lembrete"
      description="Cria o gatilho do lead: ele recebe um WhatsApp antes do compromisso."
      footer={
        selectedAppointment && (
          <Button className="h-12 w-full rounded-full" disabled={saveLeadTrigger.isPending} onClick={createTrigger}>
            {saveLeadTrigger.isPending ? "Criando…" : "Criar gatilho"}
          </Button>
        )
      }
    >
      {!selectedAppointment ? (
        <QuickMenuEmpty>Nenhum compromisso pela frente com lead que tenha WhatsApp.</QuickMenuEmpty>
      ) : (
        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Compromisso</p>
            <div className="scroll-hidden-x -mx-1 flex gap-2 overflow-x-auto px-1">
              {upcomingAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    setSelectedAppointmentId(appointment.id);
                    setMessageDraft(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-[18px] border px-3 py-2 text-left transition-colors",
                    appointment.id === selectedAppointment.id ? "border-foreground bg-foreground text-background" : "border-line bg-card",
                  )}
                >
                  <span className="block max-w-40 truncate text-sm font-semibold">{appointment.lead?.name}</span>
                  <span className="block text-[11px] opacity-70">{formatAppointmentWhen(appointment)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Enviar antes</p>
            <div className="flex flex-wrap gap-2">
              {OFFSET_OPTIONS.map((option) => (
                <button
                  key={option.minutes}
                  type="button"
                  onClick={() => setOffsetMinutes(option.minutes)}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm transition-colors",
                    offsetMinutes === option.minutes ? "border-foreground bg-foreground text-background" : "border-line bg-card",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Mensagem para o lead</p>
            <Textarea
              rows={3}
              value={message}
              onChange={(event) => setMessageDraft(event.target.value)}
              className="resize-none rounded-[18px]"
            />
            <p className="text-[11px] text-muted-foreground">
              {LEAD_NAME_PLACEHOLDER} vira o primeiro nome do lead. Se ele já tinha um gatilho de “Retorno combinado”, este substitui.
            </p>
          </section>
        </div>
      )}
    </QuickMenuSheet>
  );
}
