"use client";

import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  CalculatorContextDefaults,
  CalculatorField,
  CalculatorValues,
} from "@/features/accounting/lib/calculator/calculator-registry";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

// Rascunho do que está na tela: dinheiro já em centavos, % e números como texto
// (para aceitar vírgula e campo vazio), boolean e select como estão.
export type CalculatorFieldDraft = string | number | boolean;
export type CalculatorDrafts = Record<string, CalculatorFieldDraft>;

const MAX_MONEY_DIGITS = 15;

export function formatMoneyInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseMoneyInput(text: string): number {
  const digits = text.replace(/\D/g, "").slice(0, MAX_MONEY_DIGITS);
  return digits ? Number(digits) : 0;
}

export function bpsToPercentText(bps: number): string {
  return (bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function percentTextToBps(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const percent = Number.parseFloat(normalized);
  return Number.isFinite(percent) ? Math.round(percent * 100) : 0;
}

function resolvePrefill(field: CalculatorField, context: CalculatorContextDefaults | null): CalculatorValues[string] {
  if (!field.prefillFrom || !context) return undefined;
  const prefilled = context[field.prefillFrom];
  if (field.type === "select" && !field.options?.some((option) => option.value === prefilled)) return undefined;
  return prefilled;
}

export function isFieldPrefilled(field: CalculatorField, context: CalculatorContextDefaults | null): boolean {
  return resolvePrefill(field, context) !== undefined;
}

export function buildInitialDraft(field: CalculatorField, context: CalculatorContextDefaults | null): CalculatorFieldDraft {
  const initialValue = resolvePrefill(field, context) ?? field.defaultValue;
  switch (field.type) {
    case "money":
      return typeof initialValue === "number" ? initialValue : 0;
    case "percent":
      return typeof initialValue === "number" ? bpsToPercentText(initialValue) : "";
    case "number":
      return typeof initialValue === "number" ? String(initialValue) : "";
    case "boolean":
      return initialValue === true;
    case "select":
      return typeof initialValue === "string" ? initialValue : (field.options?.[0]?.value ?? "");
    case "date":
      return typeof initialValue === "string" ? initialValue : "";
  }
}

export function toSubmitValue(field: CalculatorField, draft: CalculatorFieldDraft | undefined): CalculatorValues[string] {
  switch (field.type) {
    case "money":
      return typeof draft === "number" ? draft : 0;
    case "percent":
      return percentTextToBps(typeof draft === "string" ? draft : "");
    case "number": {
      if (typeof draft !== "string" || draft.trim() === "") return undefined;
      const parsed = Number(draft.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "boolean":
      return draft === true;
    case "select":
      return typeof draft === "string" ? draft : undefined;
    case "date":
      return typeof draft === "string" && draft ? draft : undefined;
  }
}

interface CalculatorFieldInputProps {
  field: CalculatorField;
  inputId: string;
  draft: CalculatorFieldDraft | undefined;
  isPrefilled: boolean;
  onChange: (draft: CalculatorFieldDraft) => void;
}

function FieldLabel({ field, inputId }: { field: CalculatorField; inputId: string }) {
  return (
    <Label htmlFor={inputId} className="inline-flex items-center gap-1.5 text-sm">
      {field.label}
      {field.termId && <FiscalTermHint termId={field.termId} />}
    </Label>
  );
}

function PrefilledBadge() {
  return (
    <p className="inline-flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300">
      <Building2 className="size-3" />
      preenchido com os dados da sua empresa
    </p>
  );
}

/** Um campo da calculadora, desenhado a partir de `field.type`. */
export function CalculatorFieldInput({ field, inputId, draft, isPrefilled, onChange }: CalculatorFieldInputProps) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2">
        <div className="space-y-0.5">
          <FieldLabel field={field} inputId={inputId} />
          {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
          {isPrefilled && <PrefilledBadge />}
        </div>
        <Switch id={inputId} checked={draft === true} onCheckedChange={(isChecked) => onChange(isChecked)} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel field={field} inputId={inputId} />
      {field.type === "money" && (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
          <Input
            id={inputId}
            inputMode="numeric"
            className="pl-9 tabular-nums"
            value={formatMoneyInput(typeof draft === "number" ? draft : 0)}
            onChange={(event) => onChange(parseMoneyInput(event.target.value))}
          />
        </div>
      )}
      {field.type === "percent" && (
        <div className="relative">
          <Input
            id={inputId}
            inputMode="decimal"
            placeholder="0"
            className="pr-8 tabular-nums"
            value={typeof draft === "string" ? draft : ""}
            onChange={(event) => onChange(event.target.value.replace(/[^\d,.]/g, ""))}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
        </div>
      )}
      {field.type === "number" && (
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          className="tabular-nums"
          value={typeof draft === "string" ? draft : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {field.type === "date" && (
        <Input id={inputId} type="date" value={typeof draft === "string" ? draft : ""} onChange={(event) => onChange(event.target.value)} />
      )}
      {field.type === "select" && (
        <Select value={typeof draft === "string" ? draft : ""} onValueChange={(selected) => onChange(selected)}>
          <SelectTrigger id={inputId} className="w-full">
            <SelectValue placeholder="Escolha" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      {isPrefilled && <PrefilledBadge />}
    </div>
  );
}
