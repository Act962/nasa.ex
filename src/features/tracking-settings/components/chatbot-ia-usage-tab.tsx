"use client";

import { useMemo, useState } from "react";
import { Activity, BarChart3, Wrench, Bot, Layers, Sparkles } from "lucide-react";
import { ProviderIcon } from "./provider-icons";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Spinner } from "@/components/spinner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  type AiUsageProviderFilter,
  useQueryAiUsage,
} from "../hooks/use-tracking";

const chartConfig = {
  totalTokens: {
    label: "Tokens",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const PROVIDER_FILTER_OPTIONS: {
  value: AiUsageProviderFilter;
  label: string;
}[] = [
  { value: "all", label: "Todos os providers" },
  { value: "NASA", label: "Padrão NASA" },
  { value: "OPENAI", label: "OpenAI" },
  { value: "ANTHROPIC", label: "Anthropic" },
  { value: "GOOGLE", label: "Google" },
];

function ProviderFilterIcon({ value }: { value: AiUsageProviderFilter }) {
  if (value === "all") return <Layers className="size-4 shrink-0" />;
  if (value === "NASA") return <Sparkles className="size-4 shrink-0" />;
  return <ProviderIcon provider={value} className="size-4 shrink-0" />;
}

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function ChatBotIaUsageTab({ trackingId }: { trackingId: string }) {
  const [days, setDays] = useState("30");
  const [provider, setProvider] = useState<AiUsageProviderFilter>("all");
  const { usage, isLoadingUsage } = useQueryAiUsage(
    trackingId,
    Number(days),
    provider,
  );

  if (isLoadingUsage || !usage) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner />
      </div>
    );
  }

  const { totals, daily, recent } = usage;

  // Preenche dias sem atividade com 0 pra deixar o eixo X contínuo
  // (mais legível: 30 barras visíveis em vez de só os dias com runs).
  const chartData = useMemo(() => {
    const map = new Map<string, { totalTokens: number; runs: number }>();
    for (const d of daily) {
      const iso = new Date(d.day).toISOString().slice(0, 10);
      map.set(iso, { totalTokens: d.totalTokens, runs: d.runs });
    }

    const out: { day: string; label: string; totalTokens: number; runs: number }[] = [];
    const end = new Date();
    const start = new Date();
    start.setUTCDate(end.getUTCDate() - (Number(days) - 1));

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const point = map.get(iso) ?? { totalTokens: 0, runs: 0 };
      out.push({
        day: iso,
        label: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        ...point,
      });
    }
    return out;
  }, [daily, days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Uso da IA</h3>
          <p className="text-muted-foreground text-sm">
            Quantos tokens a IA do atendimento consumiu no período selecionado.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={provider}
            onValueChange={(v) => setProvider(v as AiUsageProviderFilter)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <ProviderFilterIcon value={opt.value} />
                    <span>{opt.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Activity className="size-4" />}
          label="Execuções"
          value={numberFormatter.format(totals.runs)}
        />
        <StatCard
          icon={<BarChart3 className="size-4" />}
          label="Total de tokens"
          value={numberFormatter.format(totals.totalTokens)}
        />
        <StatCard
          icon={<Bot className="size-4" />}
          label="Tokens de entrada"
          value={numberFormatter.format(totals.inputTokens)}
        />
        <StatCard
          icon={<Wrench className="size-4" />}
          label="Chamadas a tools"
          value={numberFormatter.format(totals.toolCalls)}
        />
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Tokens por dia</h4>
          <span className="text-muted-foreground text-xs">
            {daily.length} {daily.length === 1 ? "dia" : "dias"} com atividade
          </span>
        </div>
        {daily.length === 0 ? (
          <p className="text-muted-foreground text-sm py-10 text-center">
            Sem execuções no período.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                fontSize={11}
                width={48}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelKey="label"
                    formatter={(value) => [
                      numberFormatter.format(Number(value)),
                      " tokens",
                    ]}
                  />
                }
              />
              <Bar
                dataKey="totalTokens"
                fill="var(--color-totalTokens)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Execuções recentes</h4>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center border rounded-lg">
            Nenhuma execução registrada ainda.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Tools</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {dateFormatter.format(new Date(row.createdAt))}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.modelId}
                    </TableCell>
                    <TableCell>
                      {row.usingCustom ? (
                        <Badge variant="secondary">
                          {row.provider ?? "Custom"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">NASA</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFormatter.format(row.inputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFormatter.format(row.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {numberFormatter.format(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.toolCalls}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
