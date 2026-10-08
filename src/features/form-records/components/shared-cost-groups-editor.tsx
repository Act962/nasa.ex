"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sumGroupCents, type SharedCostGroup, type SharedCostLine } from "@/features/form-records/lib/compute-closing";
import { formatCents, parseDecimalInput } from "@/features/form-records/lib/measure-units";

/**
 * Custos compartilhados do período (spec 0075, RF-10): grupos nomeados pelo
 * usuário, cada um com suas linhas. O total de cada grupo é rateado entre os
 * clientes pelo número de fichas.
 */

function newLine(): SharedCostLine {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unit: "un", totalCents: 0, date: null };
}

function centsToText(cents: number): string {
  return cents === 0 ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SharedCostGroupsEditor({
  groups,
  onChange,
  isReadOnly,
}: {
  groups: SharedCostGroup[];
  onChange: (groups: SharedCostGroup[]) => void;
  isReadOnly: boolean;
}) {
  const updateGroup = (groupId: string, partial: Partial<SharedCostGroup>) =>
    onChange(groups.map((group) => (group.id === groupId ? { ...group, ...partial } : group)));
  const updateLine = (group: SharedCostGroup, lineId: string, partial: Partial<SharedCostLine>) =>
    updateGroup(group.id, { lines: group.lines.map((line) => (line.id === lineId ? { ...line, ...partial } : line)) });

  if (groups.length === 0 && isReadOnly) {
    return <p className="text-sm text-muted-foreground">Nenhum custo compartilhado neste período.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              value={group.name}
              disabled={isReadOnly}
              maxLength={60}
              aria-label="Nome do grupo de custo"
              onChange={(event) => updateGroup(group.id, { name: event.target.value })}
              className="max-w-xs font-medium"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums">Total: {formatCents(sumGroupCents(group))}</span>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover o grupo ${group.name}`}
                  onClick={() => onChange(groups.filter((current) => current.id !== group.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {group.lines.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma linha neste grupo.</p>}
          <ul className="space-y-2">
            {group.lines.map((line) => (
              <li key={line.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_8rem_9rem_auto]">
                <Input
                  value={line.description}
                  disabled={isReadOnly}
                  maxLength={120}
                  placeholder="Descrição"
                  aria-label="Descrição"
                  onChange={(event) => updateLine(group, line.id, { description: event.target.value })}
                  className="col-span-2 sm:col-span-1"
                />
                <Input
                  defaultValue={line.quantity === 0 ? "" : line.quantity.toLocaleString("pt-BR")}
                  disabled={isReadOnly}
                  inputMode="decimal"
                  placeholder="Qtd."
                  aria-label="Quantidade"
                  onBlur={(event) => updateLine(group, line.id, { quantity: Math.max(0, parseDecimalInput(event.target.value) ?? 0) })}
                />
                <Input
                  value={line.unit}
                  disabled={isReadOnly}
                  maxLength={20}
                  placeholder="Medida"
                  aria-label="Medida"
                  onChange={(event) => updateLine(group, line.id, { unit: event.target.value })}
                />
                <Input
                  key={`${line.id}-${line.totalCents}`}
                  defaultValue={centsToText(line.totalCents)}
                  disabled={isReadOnly}
                  inputMode="decimal"
                  placeholder="Valor (R$)"
                  aria-label="Valor total em reais"
                  onBlur={(event) =>
                    updateLine(group, line.id, { totalCents: Math.max(0, Math.round((parseDecimalInput(event.target.value) ?? 0) * 100)) })
                  }
                />
                <Input
                  type="date"
                  value={line.date ?? ""}
                  disabled={isReadOnly}
                  aria-label="Data"
                  onChange={(event) => updateLine(group, line.id, { date: event.target.value || null })}
                />
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remover linha"
                    onClick={() => updateGroup(group.id, { lines: group.lines.filter((current) => current.id !== line.id) })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!isReadOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => updateGroup(group.id, { lines: [...group.lines, newLine()] })}>
              <Plus className="size-4" />
              Adicionar linha
            </Button>
          )}
        </div>
      ))}

      {!isReadOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={groups.length >= 10}
          onClick={() => onChange([...groups, { id: crypto.randomUUID(), name: "Novo custo compartilhado", lines: [newLine()] }])}
        >
          <Plus className="size-4" />
          Adicionar grupo de custo
        </Button>
      )}
    </div>
  );
}
