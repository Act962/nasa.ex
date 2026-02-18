"use client";

import { ReactNode, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScheduleEvent,
  DayAvailability,
  DAY_NAMES,
  DEFAULT_AVAILABILITY,
  TIME_OPTIONS,
  generateSlotsFromRange,
} from "@/features/agenda/types/types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function CreateAgendaModal({ open, onOpenChange, children }: Props) {
  const { id } = useParams();
  const router = useRouter();
  const isEditing = id && id !== "novo";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");
  const [availability, setAvailability] = useState<DayAvailability[]>(
    DEFAULT_AVAILABILITY.map((d) => ({ ...d })),
  );

  const toggleDay = (dayOfWeek: number) => {
    setAvailability((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, enabled: !d.enabled } : d,
      ),
    );
  };

  const updateTime = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    setAvailability((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const updated = { ...d, [field]: value };
        updated.slots = generateSlotsFromRange(
          updated.startTime,
          updated.endTime,
          duration,
        );
        return updated;
      }),
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast("Preencha o nome do evento");
      return;
    }
  };

  // Regenerate slots based on current duration
  const finalAvailability = availability.map((d) => ({
    ...d,
    slots: generateSlotsFromRange(d.startTime, d.endTime, duration),
  }));

  const event: ScheduleEvent = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: description.trim(),
    duration,
    location: location.trim(),
    availability: finalAvailability,
    createdAt: new Date().toISOString(),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="overflow-y-a uto">
        <ScrollArea className="h-[calc(100vh-100px)] px-4">
          <DialogTitle>
            {isEditing ? "Editar Evento" : "Novo Evento"}
          </DialogTitle>

          <main className="py-8">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="title">Nome do evento</Label>
                <Input
                  id="title"
                  placeholder="Ex: Consulta inicial"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea
                  id="desc"
                  placeholder="Descreva o evento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="duration"
                    className="flex items-center gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" /> Duração (min)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min={15}
                    step={15}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="flex items-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Local
                  </Label>
                  <Input
                    id="location"
                    placeholder="Online / Presencial"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Availability */}
              <div>
                <CardTitle className="text-base">Disponibilidade</CardTitle>
                <CardDescription>
                  Defina os horários de início e fim para cada dia da semana.
                </CardDescription>
              </div>
              {availability.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
                >
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={() => toggleDay(day.dayOfWeek)}
                  />
                  <span className="w-20 font-medium text-sm">
                    {DAY_NAMES[day.dayOfWeek]}
                  </span>

                  <div className="flex flex-1 items-center gap-3">
                    <Select
                      value={day.startTime}
                      onValueChange={(v) =>
                        updateTime(day.dayOfWeek, "startTime", v)
                      }
                      disabled={!day.enabled}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={day.endTime}
                      onValueChange={(v) =>
                        updateTime(day.dayOfWeek, "endTime", v)
                      }
                      disabled={!day.enabled}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <DialogFooter className="flex gap-3">
                <Button onClick={handleSubmit} className="flex-1">
                  {isEditing ? "Salvar Alterações" : "Criar Evento"}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
              </DialogFooter>
            </div>
          </main>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
