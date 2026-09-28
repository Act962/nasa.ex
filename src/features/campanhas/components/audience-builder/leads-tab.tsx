"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddRecipientsFromLeads } from "../../hooks/use-broadcast-audience";
import type { AudienceFilter } from "../../schema/broadcast-schemas";

const TEMPERATURES: Array<{ value: "COLD" | "WARM" | "HOT" | "VERY_HOT"; label: string }> = [
  { value: "COLD", label: "Frio" },
  { value: "WARM", label: "Morno" },
  { value: "HOT", label: "Quente" },
  { value: "VERY_HOT", label: "Muito quente" },
];

const ACTIONS: Array<{ value: "ACTIVE" | "WON" | "LOST"; label: string }> = [
  { value: "ACTIVE", label: "Ativos" },
  { value: "WON", label: "Ganhos" },
  { value: "LOST", label: "Perdidos" },
];

/**
 * Aba "Leads" — filtros básicos (temperatura + situação) sobre os leads do
 * tracking de origem. Sem filtro = todos os leads ativos com telefone.
 */
export function LeadsAudienceTab({ broadcastId }: { broadcastId: string }) {
  const [temperatures, setTemperatures] = useState<AudienceFilter["temperatureFilter"]>(
    [],
  );
  const [action, setAction] = useState<"ACTIVE" | "WON" | "LOST">("ACTIVE");

  const addRecipients = useAddRecipientsFromLeads(broadcastId);

  function toggleTemperature(value: "COLD" | "WARM" | "HOT" | "VERY_HOT") {
    setTemperatures((current) => {
      const list = current ?? [];
      return list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
    });
  }

  function handleAdd() {
    addRecipients.mutate(
      {
        broadcastId,
        filters: {
          actionFilter: action,
          ...(temperatures && temperatures.length > 0
            ? { temperatureFilter: temperatures }
            : {}),
        },
      },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.added} destinatário(s) adicionado(s). Total: ${result.totalRecipients}.`,
          );
        },
        onError: (error) => {
          toast.error(error.message ?? "Falha ao adicionar leads");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label>Situação dos leads</Label>
        <Select value={action} onValueChange={(value) => setAction(value as typeof action)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Temperatura (opcional)</Label>
        <div className="flex flex-wrap gap-4">
          {TEMPERATURES.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={temperatures?.includes(item.value) ?? false}
                onCheckedChange={() => toggleTemperature(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Button onClick={handleAdd} disabled={addRecipients.isPending}>
          {addRecipients.isPending ? "Adicionando…" : "Adicionar leads"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Telefones são normalizados e duplicados são ignorados automaticamente.
        </p>
      </div>
    </div>
  );
}
