"use client";

import { Repeat } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUBSCRIPTION_PERIOD_LABELS,
  SUBSCRIPTION_PERIODS,
  type SubscriptionPeriod,
} from "@/features/nasa-route/lib/formats";

export interface SubscriptionData {
  subscriptionPeriod: SubscriptionPeriod | null;
}

interface Props {
  value: SubscriptionData;
  onChange: (next: SubscriptionData) => void;
}

export function SubscriptionSection({ value, onChange }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800/40 dark:bg-indigo-900/10">
      <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
        <Repeat className="size-4" />
        <h3 className="text-sm font-semibold">Cobrança recorrente</h3>
      </div>

      <p className="text-sm text-indigo-900/80 dark:text-indigo-200/80">
        O aluno paga em STARS na primeira matrícula. A cada período, debitamos
        automaticamente o valor do plano. Se o saldo for insuficiente por 7
        cobranças seguidas, o acesso é encerrado.
      </p>

      <div className="space-y-2">
        <Label htmlFor="subscriptionPeriod">Periodicidade</Label>
        <Select
          value={value.subscriptionPeriod ?? "monthly"}
          onValueChange={(v) =>
            onChange({ subscriptionPeriod: v as SubscriptionPeriod })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBSCRIPTION_PERIODS.map((p) => (
              <SelectItem key={p} value={p} disabled={p !== "monthly"}>
                {SUBSCRIPTION_PERIOD_LABELS[p]}
                {p !== "monthly" && " (em breve)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          O preço da assinatura é o do plano padrão (definido em "Preço (STARs)" abaixo).
        </p>
      </div>
    </div>
  );
}
