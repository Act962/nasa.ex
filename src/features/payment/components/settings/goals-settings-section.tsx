"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  usePaymentGoalStatus,
  useUpdatePaymentGoalConfig,
  useUpsertPaymentGoalMonth,
} from "../../hooks/use-payment-goals";
import { formatCurrency, maskCurrency, parseCurrencyToCents } from "../../lib/format";
import { describePaymentError } from "../../lib/describe-error";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ALERT_FIELDS = [
  {
    key: "alertReserveAtRisk",
    label: "Reserva em risco",
    hint: "Quando o mês caminha para fechar abaixo do caixa mínimo",
  },
  {
    key: "alertWeeklySummary",
    label: "Resumo semanal",
    hint: "Toda segunda, com meta, despesas a pagar e caixa projetado",
  },
  {
    key: "alertGoalReached",
    label: "Meta batida",
    hint: "Quando a receita recebida atinge a meta do mês",
  },
  {
    key: "alertExpenseBreaksReserve",
    label: "Despesa crítica",
    hint: "Ao lançar despesa que derruba o caixa abaixo da reserva",
  },
] as const;

type AlertKey = (typeof ALERT_FIELDS)[number]["key"];

export function GoalsSettingsSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data } = usePaymentGoalStatus({ year, month });
  const updateConfig = useUpdatePaymentGoalConfig();
  const upsertMonth = useUpsertPaymentGoalMonth();

  const [targetInput, setTargetInput] = useState("");
  const [reserveInput, setReserveInput] = useState("");
  const [alerts, setAlerts] = useState<Record<AlertKey, boolean>>({
    alertReserveAtRisk: true,
    alertWeeklySummary: true,
    alertGoalReached: true,
    alertExpenseBreaksReserve: true,
  });
  const [monthTargetInput, setMonthTargetInput] = useState("");
  const [monthReserveInput, setMonthReserveInput] = useState("");

  const config = data?.config;
  useEffect(() => {
    if (!config) return;
    setTargetInput(
      config.defaultRevenueTargetCents > 0
        ? maskCurrency(String(config.defaultRevenueTargetCents))
        : "",
    );
    setReserveInput(String(config.defaultCashReservePercent));
    setAlerts({
      alertReserveAtRisk: config.alertReserveAtRisk,
      alertWeeklySummary: config.alertWeeklySummary,
      alertGoalReached: config.alertGoalReached,
      alertExpenseBreaksReserve: config.alertExpenseBreaksReserve,
    });
  }, [config]);

  async function handleSaveDefaults() {
    const percent = Number(reserveInput || 0);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      return toast.error("A reserva precisa ser um percentual entre 0 e 100");
    }
    try {
      await updateConfig.mutateAsync({
        defaultRevenueTargetCents: parseCurrencyToCents(targetInput),
        defaultCashReservePercent: Math.round(percent),
        ...alerts,
      });
      toast.success("Metas atualizadas");
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível salvar as metas"));
    }
  }

  async function handleSaveMonth() {
    const hasTarget = monthTargetInput.trim().length > 0;
    const hasReserve = monthReserveInput.trim().length > 0;
    const percent = Number(monthReserveInput || 0);
    if (hasReserve && (Number.isNaN(percent) || percent < 0 || percent > 100)) {
      return toast.error("A reserva do mês precisa ser um percentual entre 0 e 100");
    }
    try {
      await upsertMonth.mutateAsync({
        year,
        month,
        revenueTargetCents: hasTarget ? parseCurrencyToCents(monthTargetInput) : null,
        cashReservePercent: hasReserve ? Math.round(percent) : null,
      });
      toast.success(
        hasTarget || hasReserve
          ? `Ajuste salvo para ${MONTH_NAMES[month - 1]}`
          : `${MONTH_NAMES[month - 1]} voltou a usar o padrão`,
      );
      setMonthTargetInput("");
      setMonthReserveInput("");
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível salvar o ajuste"));
    }
  }

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Target className="size-4 text-emerald-400" /> Metas e reserva de caixa
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Meta de vendas por mês</Label>
          <Input
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={targetInput}
            onChange={(event) => setTargetInput(maskCurrency(event.target.value))}
          />
          <p className="text-[11px] text-muted-foreground">
            Medida contra o que for recebido no mês, não contra o que for vendido.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Reserva de caixa (% da receita)</Label>
          <Input
            inputMode="numeric"
            placeholder="20"
            value={reserveInput}
            onChange={(event) =>
              setReserveInput(event.target.value.replace(/\D/g, "").slice(0, 3))
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Quanto da receita do mês precisa sobrar em caixa depois das despesas.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {ALERT_FIELDS.map((field) => (
          <div key={field.key} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm">{field.label}</p>
              <p className="text-[11px] text-muted-foreground">{field.hint}</p>
            </div>
            <Switch
              checked={alerts[field.key]}
              onCheckedChange={(checked) =>
                setAlerts((current) => ({ ...current, [field.key]: checked }))
              }
            />
          </div>
        ))}
      </div>

      <Button
        onClick={handleSaveDefaults}
        disabled={updateConfig.isPending}
        className="w-full bg-[#1E90FF] text-white"
      >
        {updateConfig.isPending ? "Salvando..." : "Salvar metas"}
      </Button>

      <Separator />

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Ajuste de um mês específico</p>
          <p className="text-[11px] text-muted-foreground">
            Campo em branco herda o padrão acima. Salvar com os dois em branco
            remove o ajuste do mês.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data && (
          <p className="text-[11px] text-muted-foreground">
            Hoje {MONTH_NAMES[month - 1]} usa{" "}
            {data.status.hasRevenueTarget
              ? formatCurrency(data.status.revenueTargetCents)
              : "nenhuma meta"}{" "}
            e {data.status.cashReservePercent}% de reserva
            {data.status.hasMonthOverride ? " (ajuste próprio)" : " (padrão)"}.
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            inputMode="numeric"
            placeholder="Meta do mês"
            value={monthTargetInput}
            onChange={(event) => setMonthTargetInput(maskCurrency(event.target.value))}
          />
          <Input
            inputMode="numeric"
            placeholder="Reserva (%)"
            value={monthReserveInput}
            onChange={(event) =>
              setMonthReserveInput(event.target.value.replace(/\D/g, "").slice(0, 3))
            }
          />
        </div>

        <Button
          variant="outline"
          onClick={handleSaveMonth}
          disabled={upsertMonth.isPending}
          className="w-full"
        >
          {upsertMonth.isPending ? "Salvando..." : "Salvar ajuste do mês"}
        </Button>
      </div>
    </div>
  );
}
