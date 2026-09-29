"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LeadMetricsFilter } from "../../schema/broadcast-schemas";

// Filtro "Comportamento" das audiências (spec 0035): usa as métricas do
// "Auditar Lead". Lead ainda não auditado fica fora quando o filtro é usado.

const INTEREST_OPTIONS = [
  { value: "HIGH", label: "Alto" },
  { value: "MEDIUM", label: "Médio" },
  { value: "LOW", label: "Baixo" },
] as const;

const ANY_VALUE = "any";
const POTENTIAL_OPTIONS = [40, 60, 80];
const LOSS_OPTIONS = [10, 30, 50];

interface LeadMetricsFilterFieldsProps {
  value: LeadMetricsFilter;
  onChange: (value: LeadMetricsFilter) => void;
}

export function LeadMetricsFilterFields({ value, onChange }: LeadMetricsFilterFieldsProps) {
  const toggleInterest = (level: (typeof INTEREST_OPTIONS)[number]["value"]) => {
    const current = value.interestLevels ?? [];
    const next = current.includes(level) ? current.filter((item) => item !== level) : [...current, level];
    onChange({ ...value, interestLevels: next.length > 0 ? next : undefined });
  };
  const isActive =
    Boolean(value.interestLevels?.length) ||
    value.minPurchasePotential !== undefined ||
    value.maxInteractionLossRate !== undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label>Comportamento (opcional)</Label>
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs text-muted-foreground">Interesse:</span>
        {INTEREST_OPTIONS.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={value.interestLevels?.includes(option.value) ?? false}
              onCheckedChange={() => toggleInterest(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Select
          value={value.minPurchasePotential?.toString() ?? ANY_VALUE}
          onValueChange={(selected) =>
            onChange({ ...value, minPurchasePotential: selected === ANY_VALUE ? undefined : Number(selected) })
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Qualquer potencial de compra</SelectItem>
            {POTENTIAL_OPTIONS.map((potential) => (
              <SelectItem key={potential} value={String(potential)}>
                Potencial a partir de {potential}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={value.maxInteractionLossRate?.toString() ?? ANY_VALUE}
          onValueChange={(selected) =>
            onChange({ ...value, maxInteractionLossRate: selected === ANY_VALUE ? undefined : Number(selected) })
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_VALUE}>Qualquer perda de interação</SelectItem>
            {LOSS_OPTIONS.map((loss) => (
              <SelectItem key={loss} value={String(loss)}>
                Perda de até {loss}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isActive && (
        <p className="text-xs text-muted-foreground">
          Só entram leads já auditados (botão "Auditar Lead" no chat ou no contato).
        </p>
      )}
    </div>
  );
}
