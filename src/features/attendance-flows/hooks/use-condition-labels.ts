"use client";

import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { useTags } from "@/features/tags/hooks/use-tags";
import { fieldOptionOf, OPERATOR_LABELS, parseTimeRange, TEMPERATURE_LABELS, VALUELESS_OPERATORS, WEEKDAY_LABELS, type ConditionRule } from "../lib/conditions";
import { useAttendanceNumberOptions } from "./use-attendance-flows";

export interface ConditionChoice {
  id: string;
  name: string;
  color?: string | null;
}

/** Opções e nomes que a Condição mostra: etiquetas, membros e colunas da empresa (spec 0139). */
export function useConditionChoices() {
  const { tags } = useTags();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: numberOptions } = useAttendanceNumberOptions();
  return useMemo(() => {
    const tagChoices: ConditionChoice[] = tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }));
    const memberChoices: ConditionChoice[] = (activeOrganization?.members ?? []).map((member) => ({ id: member.userId, name: member.user.name }));
    const columnChoices: ConditionChoice[] = (numberOptions?.numbers ?? []).flatMap((number) =>
      number.columns.map((column) => ({ id: column.id, name: `${column.name} · ${number.name}` })),
    );
    return { tagChoices, memberChoices, columnChoices };
  }, [tags, activeOrganization?.members, numberOptions?.numbers]);
}

/** "Etiqueta", "É", "Cliente": o que o cartão e o painel mostram de uma regra. */
export function useDescribeConditionRule() {
  const { tagChoices, memberChoices, columnChoices } = useConditionChoices();
  return (rule: ConditionRule): { fieldLabel: string; operatorLabel: string; valueLabel: string } => {
    const option = fieldOptionOf(rule.field);
    const firstValue = Array.isArray(rule.value) ? (rule.value[0] ?? "") : rule.value;
    const nameIn = (choices: ConditionChoice[]) => choices.find((choice) => choice.id === firstValue)?.name ?? "(escolha)";
    let valueLabel = "";
    if (!VALUELESS_OPERATORS.has(rule.operator)) {
      switch (option.kind) {
        case "tag":
          valueLabel = nameIn(tagChoices);
          break;
        case "responsible":
          valueLabel = nameIn(memberChoices);
          break;
        case "column":
          valueLabel = nameIn(columnChoices);
          break;
        case "temperature":
          valueLabel = TEMPERATURE_LABELS[firstValue] ?? "(escolha)";
          break;
        case "weekday": {
          const days = Array.isArray(rule.value) ? rule.value : [rule.value];
          valueLabel = days.filter(Boolean).map((day) => WEEKDAY_LABELS[Number(day)]?.slice(0, 3)).join(", ") || "(escolha)";
          break;
        }
        case "time": {
          const range = parseTimeRange(rule.value);
          valueLabel = range ? String(firstValue).replace("-", " às ") : "(escolha)";
          break;
        }
        default:
          valueLabel = firstValue ? `"${firstValue}"` : "(escreva)";
      }
    }
    return { fieldLabel: option.label, operatorLabel: OPERATOR_LABELS[rule.operator], valueLabel };
  };
}
