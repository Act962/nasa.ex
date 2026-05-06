"use client";

import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
];

export interface EventData {
  eventStartsAt: Date | null;
  eventEndsAt: Date | null;
  eventStreamUrl: string | null;
  eventTimezone: string | null;
  eventLocationNote: string | null;
}

interface Props {
  value: EventData;
  onChange: (next: EventData) => void;
}

/**
 * Converte Date pra string compatível com `<input type="datetime-local">`
 * (formato `YYYY-MM-DDTHH:mm` em horário LOCAL — sem timezone).
 */
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function EventSection({ value, onChange }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-800/40 dark:bg-rose-900/10">
      <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
        <Calendar className="size-4" />
        <h3 className="text-sm font-semibold">Detalhes do evento</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="eventStartsAt">Início *</Label>
          <Input
            id="eventStartsAt"
            type="datetime-local"
            value={toLocalInput(value.eventStartsAt)}
            onChange={(e) =>
              onChange({ ...value, eventStartsAt: fromLocalInput(e.target.value) })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eventEndsAt">Fim (opcional)</Label>
          <Input
            id="eventEndsAt"
            type="datetime-local"
            value={toLocalInput(value.eventEndsAt)}
            onChange={(e) =>
              onChange({ ...value, eventEndsAt: fromLocalInput(e.target.value) })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventTimezone">Fuso horário</Label>
        <Select
          value={value.eventTimezone ?? "America/Sao_Paulo"}
          onValueChange={(v) => onChange({ ...value, eventTimezone: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventStreamUrl">Link de transmissão *</Label>
        <Input
          id="eventStreamUrl"
          type="url"
          value={value.eventStreamUrl ?? ""}
          onChange={(e) =>
            onChange({ ...value, eventStreamUrl: e.target.value || null })
          }
          placeholder="https://meet.google.com/… ou https://zoom.us/j/…"
          required
        />
        <p className="text-xs text-muted-foreground">
          O link só é mostrado pro aluno a partir de 30 minutos antes do horário.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventLocationNote">Observações (opcional)</Label>
        <Textarea
          id="eventLocationNote"
          value={value.eventLocationNote ?? ""}
          onChange={(e) =>
            onChange({ ...value, eventLocationNote: e.target.value || null })
          }
          placeholder="Ex.: O evento será gravado e a gravação ficará disponível por 7 dias."
          rows={3}
        />
      </div>
    </div>
  );
}
