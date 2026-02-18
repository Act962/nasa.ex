"use client";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Check,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, getDay, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";
import {
  ScheduleEvent,
  DayAvailability,
  TimeSlot,
  generateSlotsFromRange,
} from "../types/types";

const bookingSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().min(8, "Telefone inválido").max(20),
  notes: z.string().max(500).optional(),
});

export function ClientBooking() {
  const { eventId } = useParams();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<"date" | "time" | "form" | "done">("date");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mock event data to make the component functional
  const event: ScheduleEvent = {
    id: (eventId as string) || "mock-event-id",
    title: "Consultoria Técnica Individual",
    description:
      "Sessão de consultoria para tirar dúvidas sobre arquitetura de software e boas práticas de desenvolvimento.",
    duration: 60,
    location: "Google Meet",
    createdAt: new Date().toISOString(),
    availability: [
      {
        dayOfWeek: 1, // Segunda
        enabled: true,
        startTime: "09:00",
        endTime: "17:00",
        slots: [],
      },
      {
        dayOfWeek: 2, // Terça
        enabled: true,
        startTime: "08:30",
        endTime: "18:00",
        slots: [],
      },
      {
        dayOfWeek: 3, // Quarta
        enabled: true,
        startTime: "10:00",
        endTime: "16:00",
        slots: [],
      },
      {
        dayOfWeek: 4, // Quinta
        enabled: true,
        startTime: "09:00",
        endTime: "12:00",
        slots: [],
      },
      {
        dayOfWeek: 5, // Sexta
        enabled: true,
        startTime: "09:00",
        endTime: "17:00",
        slots: [],
      },
      {
        dayOfWeek: 6, // Sábado
        enabled: false,
        startTime: "08:00",
        endTime: "12:00",
        slots: [],
      },
      {
        dayOfWeek: 7, // Domingo
        enabled: false,
        startTime: "08:00",
        endTime: "12:00",
        slots: [],
      },
    ].map((d) => ({
      ...d,
      slots: d.enabled
        ? generateSlotsFromRange(d.startTime, d.endTime, 60)
        : [],
    })),
  };

  const enabledDays = useMemo(
    () =>
      event.availability
        .filter((d: DayAvailability) => d.enabled)
        .map((d: DayAvailability) => d.dayOfWeek),
    [event],
  );

  const disabledDays = (date: Date) => {
    const jsDay = getDay(date);
    const ourDay = jsDay === 0 ? 7 : jsDay;
    return (
      !enabledDays.includes(ourDay) || isBefore(date, startOfDay(new Date()))
    );
  };

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const jsDay = getDay(selectedDate);
    const ourDay = jsDay === 0 ? 7 : jsDay;
    const dayConfig = event.availability.find(
      (d: DayAvailability) => d.dayOfWeek === ourDay,
    );
    if (!dayConfig || !dayConfig.enabled) return [];

    // Lógica para mostrar somente os horários disponíveis dentro do range configurado
    return dayConfig.slots.filter((slot) => slot.available);
  }, [selectedDate, event]);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Evento não encontrado</h2>
          <p className="mt-2 text-muted-foreground">
            Verifique o link e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
    if (date) setStep("time");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep("form");
  };

  const handleSubmit = () => {
    const result = bookingSchema.safeParse({
      name,
      email,
      phone,
      notes,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      toast.error("Por favor, corrija os erros no formulário.");
      return;
    }

    setErrors({});
    console.log("Booking submitted:", {
      eventId,
      date: selectedDate,
      time: selectedTime,
      ...result.data,
    });
    setStep("done");
    toast.success("Agendamento realizado com sucesso!");
  };

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
              <Check className="h-8 w-8 text-accent" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Agendado!</h2>
            <p className="text-muted-foreground">
              Seu horário foi reservado para{" "}
              <strong>
                {format(selectedDate!, "dd 'de' MMMM", { locale: ptBR })}
              </strong>{" "}
              às <strong>{selectedTime}</strong>.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Você receberá os detalhes por email em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <CalendarIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
          </div>
          <p className="text-muted-foreground">{event.description}</p>
          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {event.duration} min
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {event.location}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center gap-2 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-medium ${step === "date" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            1. Data
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span
            className={`rounded-full px-3 py-1 font-medium ${step === "time" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            2. Horário
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span
            className={`rounded-full px-3 py-1 font-medium ${step === "form" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            3. Dados
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selecione uma data</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={disabledDays}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </CardContent>
          </Card>

          <div>
            {step === "time" && selectedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Horários em{" "}
                    {format(selectedDate, "dd/MM (EEEE)", { locale: ptBR })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum horário disponível neste dia.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot: TimeSlot) => (
                        <Button
                          key={slot.time}
                          variant={
                            selectedTime === slot.time ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleTimeSelect(slot.time)}
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4 gap-1"
                    onClick={() => {
                      setStep("date");
                      setSelectedDate(undefined);
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "form" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {format(selectedDate!, "dd/MM")} às {selectedTime}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Alguma informação adicional..."
                    />
                  </div>
                  <Button className="w-full" onClick={handleSubmit}>
                    Confirmar Agendamento
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => setStep("time")}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "date" && (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-8">
                <p className="text-center text-muted-foreground">
                  Selecione uma data no calendário para ver os horários
                  disponíveis.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
