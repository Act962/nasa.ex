"use client";

// Painel do bloco Condição do FlowAstro (spec 0139), no estilo do BotConversa: TODAS ou QUALQUER, cartões de regra
// e "Selecionar condição" agrupado por tipo.
import { createId } from "@paralleldrive/cuid2";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BASE_FIELD_OPTIONS,
  fieldOptionOf,
  OPERATOR_LABELS,
  OPERATORS_BY_KIND,
  parseCondition,
  parseTimeRange,
  TEMPERATURE_LABELS,
  VALUELESS_OPERATORS,
  variableFieldOf,
  WEEKDAY_LABELS,
  type ConditionData,
  type ConditionFieldOption,
  type ConditionMatch,
  type ConditionOperator,
  type ConditionRule,
} from "../../lib/conditions";
import { useConditionChoices, type ConditionChoice } from "../../hooks/use-condition-labels";

type NodeData = Record<string, unknown>;

const DEFAULT_TIME_RANGE = "08:00-18:00";

function defaultValueFor(option: ConditionFieldOption): string | string[] {
  if (option.kind === "weekday") return [];
  if (option.kind === "time") return DEFAULT_TIME_RANGE;
  return "";
}

function ChoiceSelect({ value, choices, placeholder, onChange }: { value: string; choices: ConditionChoice[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full bg-card text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.id} value={choice.id}>
            <span className="flex items-center gap-2">
              {choice.color && <span className="size-2 rounded-full" style={{ backgroundColor: choice.color }} />}
              {choice.name}
            </span>
          </SelectItem>
        ))}
        {choices.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Nada cadastrado.</p>}
      </SelectContent>
    </Select>
  );
}

function RuleValueEditor({ rule, onChange }: { rule: ConditionRule; onChange: (value: string | string[]) => void }) {
  const { tagChoices, memberChoices, columnChoices } = useConditionChoices();
  const option = fieldOptionOf(rule.field);
  const firstValue = Array.isArray(rule.value) ? (rule.value[0] ?? "") : rule.value;
  if (VALUELESS_OPERATORS.has(rule.operator)) return null;
  switch (option.kind) {
    case "tag":
      return <ChoiceSelect value={firstValue} choices={tagChoices} placeholder="Escolha a etiqueta" onChange={onChange} />;
    case "responsible":
      return <ChoiceSelect value={firstValue} choices={memberChoices} placeholder="Escolha o membro" onChange={onChange} />;
    case "column":
      return <ChoiceSelect value={firstValue} choices={columnChoices} placeholder="Escolha a coluna" onChange={onChange} />;
    case "temperature":
      return (
        <ChoiceSelect value={firstValue} choices={Object.entries(TEMPERATURE_LABELS).map(([id, name]) => ({ id, name }))} placeholder="Escolha a temperatura" onChange={onChange} />
      );
    case "weekday": {
      const days = Array.isArray(rule.value) ? rule.value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_LABELS.map((label, index) => {
            const day = String(index);
            const isSelected = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => onChange(isSelected ? days.filter((item) => item !== day) : [...days, day])}
                className={cn("rounded-md border px-2 py-1 text-[11px]", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
              >
                {label.slice(0, 3)}
              </button>
            );
          })}
        </div>
      );
    }
    case "time": {
      const [start = "08:00", end = "18:00"] = String(firstValue || DEFAULT_TIME_RANGE).split("-");
      const isValid = Boolean(parseTimeRange(`${start}-${end}`));
      return (
        <div className="flex items-center gap-2">
          <Input type="time" className="h-8 bg-card text-xs" value={start} onChange={(event) => onChange(`${event.target.value}-${end}`)} />
          <span className="text-xs text-muted-foreground">às</span>
          <Input type="time" className={cn("h-8 bg-card text-xs", !isValid && "border-destructive")} value={end} onChange={(event) => onChange(`${start}-${event.target.value}`)} />
        </div>
      );
    }
    default:
      return <Input className="h-8 bg-card text-xs" value={firstValue} placeholder="Valor" onChange={(event) => onChange(event.target.value)} />;
  }
}

export function ConditionPanel({ data, onChange, variableNames }: { data: NodeData; onChange: (data: NodeData) => void; variableNames: string[] }) {
  const condition = parseCondition(data);
  const save = (next: ConditionData) => onChange({ ...data, match: next.match, rules: next.rules });
  const updateRule = (ruleId: string, changes: Partial<ConditionRule>) =>
    save({ ...condition, rules: condition.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...changes } : rule)) });
  const addRule = (field: string) => {
    const option = fieldOptionOf(field);
    save({ ...condition, rules: [...condition.rules, { id: createId().slice(0, 10), field, operator: OPERATORS_BY_KIND[option.kind][0], value: defaultValueFor(option) }] });
  };
  const variableOptions = variableNames.map((name) => fieldOptionOf(variableFieldOf(name)));
  const groups = [
    { title: "Operações mais usadas", options: BASE_FIELD_OPTIONS.filter((option) => option.group === "Operações mais usadas") },
    { title: "Campos do contato", options: BASE_FIELD_OPTIONS.filter((option) => option.group === "Campos do contato") },
    { title: "Variáveis do fluxo", options: variableOptions },
  ].filter((group) => group.options.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Defina as condições e a regra lógica para o fluxo seguir pela saída de cima deste bloco:</p>
      <div className="space-y-2">
        {(
          [
            ["ALL", "Contato corresponde a TODAS as condições"],
            ["ANY", "Contato corresponde a QUALQUER condição"],
          ] as [ConditionMatch, string][]
        ).map(([match, label]) => (
          <label key={match} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="condition-match" className="mt-1 accent-primary" checked={condition.match === match} onChange={() => save({ ...condition, match })} />
            {label}
          </label>
        ))}
      </div>

      <Label className="text-sm">
        Lógica <span className="font-semibold">{condition.match === "ALL" ? "E" : "Ou"}</span>
      </Label>

      {condition.rules.map((rule) => {
        const option = fieldOptionOf(rule.field);
        return (
          <div key={rule.id} className="space-y-2 rounded-lg border border-border bg-muted/40 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{option.label}</span>
              <Button variant="ghost" size="icon" className="size-6" title="Tirar condição" onClick={() => save({ ...condition, rules: condition.rules.filter((item) => item.id !== rule.id) })}>
                <XIcon className="size-3.5" />
              </Button>
            </div>
            <Select value={rule.operator} onValueChange={(operator) => updateRule(rule.id, { operator: operator as ConditionOperator })}>
              <SelectTrigger className="h-8 w-full bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS_BY_KIND[option.kind].map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {OPERATOR_LABELS[operator]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RuleValueEditor rule={rule} onChange={(value) => updateRule(rule.id, { value })} />
          </div>
        );
      })}

      <Select value="" onValueChange={addRule}>
        <SelectTrigger className="w-full border-indigo-200 bg-indigo-50/60 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          <SelectValue placeholder="Selecionar condição" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.title}>
              <SelectLabel className="text-[10px] uppercase tracking-wide">{group.title}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.field} value={option.field}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {condition.rules.length === 0 && <p className="text-[11px] text-muted-foreground">Sem condições, o lead segue sempre pela saída de baixo.</p>}
    </div>
  );
}
