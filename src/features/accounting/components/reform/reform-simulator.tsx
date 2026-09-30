"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalculatorContext, useRunCalculator } from "@/features/accounting/hooks/use-accounting-calculator";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { REGIME_LABELS } from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

const SIMULATION_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
const CBS_COLOR = "#7c3aed";
const IBS_COLOR = "#0ea5e9";

const cbsIbsOutputSchema = z.object({
  year: z.number(),
  cbsRateBps: z.number(),
  ibsRateBps: z.number(),
  cbsDebitCents: z.number(),
  ibsDebitCents: z.number(),
  totalDueCents: z.number(),
  isInformativeOnly: z.boolean(),
  isInsideDas: z.boolean(),
});

type SimulationRow = z.infer<typeof cbsIbsOutputSchema>;

function formatCompactBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
}

/** Simula CBS+IBS de um mês típico em cada ano da transição, com o faturamento dos últimos 12 meses. */
export function ReformSimulator() {
  const contextQuery = useCalculatorContext();
  const runCalculator = useRunCalculator();
  const { mutateAsync: runCalculatorAsync } = runCalculator;
  const [simulationRows, setSimulationRows] = useState<SimulationRow[] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const lastSimulationKeyRef = useRef<string | null>(null);

  const calculatorContext = contextQuery.data;
  const monthlyRevenueCents = calculatorContext ? Math.round(calculatorContext.rbt12Cents / 12) : 0;

  const runSimulation = useCallback(async () => {
    if (!calculatorContext) return;
    setIsSimulating(true);
    setSimulationError(null);
    try {
      const results = await Promise.all(
        SIMULATION_YEARS.map((year) =>
          runCalculatorAsync({
            calculatorId: "cbs_ibs",
            values: {
              year,
              revenueCents: Math.round(calculatorContext.rbt12Cents / 12),
              regime: calculatorContext.regime,
              ibsCbsOutsideSimples: calculatorContext.ibsCbsOutsideSimples,
            },
          }),
        ),
      );
      const parsedRows = results.flatMap((result) => {
        const parsedOutput = cbsIbsOutputSchema.safeParse(result.output);
        return parsedOutput.success ? [parsedOutput.data] : [];
      });
      setSimulationRows(parsedRows);
    } catch {
      setSimulationError("Não foi possível simular agora. Tente de novo em instantes.");
    } finally {
      setIsSimulating(false);
    }
  }, [calculatorContext, runCalculatorAsync]);

  const simulationKey = calculatorContext
    ? `${calculatorContext.rbt12Cents}-${calculatorContext.regime}-${calculatorContext.ibsCbsOutsideSimples}`
    : null;

  // Roda sozinho uma vez por combinação de faturamento/regime; o ref evita repetir a cada render.
  useEffect(() => {
    if (!simulationKey || lastSimulationKeyRef.current === simulationKey) return;
    lastSimulationKeyRef.current = simulationKey;
    void runSimulation();
  }, [simulationKey, runSimulation]);

  const chartData = (simulationRows ?? []).map((row) => ({
    year: String(row.year),
    CBS: row.cbsDebitCents,
    IBS: row.ibsDebitCents,
  }));
  const isSimplesInsideDas = (simulationRows ?? []).some((row) => row.isInsideDas && !row.isInformativeOnly);

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-0">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          Simulador da transição
          <FiscalTermHint termId="cbs" />
          <FiscalTermHint termId="ibs" />
        </CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={!calculatorContext || isSimulating} onClick={() => void runSimulation()}>
          {isSimulating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Simular de novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {contextQuery.isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : !calculatorContext ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar seu faturamento para simular.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Base: faturamento dos últimos 12 meses <FiscalTermHint termId="rbt12" /> de{" "}
              <strong className="text-foreground">{formatCentsBrl(calculatorContext.rbt12Cents)}</strong>, ou{" "}
              <strong className="text-foreground">{formatCentsBrl(monthlyRevenueCents)}</strong> por mês, no regime{" "}
              <strong className="text-foreground">{REGIME_LABELS[calculatorContext.regime]}</strong>. Valores de um mês típico, sem créditos de
              compras.
            </p>
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              Alíquotas de 2027 em diante são estimativas oficiais: o Senado ainda vai fixar as definitivas. Use para planejar, não para pagar.
            </p>

            {calculatorContext.rbt12Cents === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há receitas lançadas no financeiro nos últimos 12 meses — lance suas vendas para ver a simulação com seus números.
              </p>
            ) : simulationError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{simulationError}</p>
            ) : !simulationRows ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={64} tickFormatter={(value) => formatCompactBrl(Number(value))} />
                      <Tooltip
                        formatter={(value) => formatCentsBrl(Number(value))}
                        labelFormatter={(label) => `Ano ${String(label)} — por mês`}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="CBS" stackId="reform" fill={CBS_COLOR} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="IBS" stackId="reform" fill={IBS_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1.5 pr-2 font-medium">Ano</th>
                        <th className="py-1.5 pr-2 font-medium">CBS</th>
                        <th className="py-1.5 pr-2 font-medium">IBS</th>
                        <th className="py-1.5 pr-2 text-right font-medium">CBS/mês</th>
                        <th className="py-1.5 pr-2 text-right font-medium">IBS/mês</th>
                        <th className="py-1.5 text-right font-medium">A recolher por fora</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {simulationRows.map((row) => (
                        <tr key={row.year} className="border-b last:border-0">
                          <td className="py-1.5 pr-2 font-medium">{row.year}</td>
                          <td className="py-1.5 pr-2">{formatBps(row.cbsRateBps)}</td>
                          <td className="py-1.5 pr-2">{formatBps(row.ibsRateBps)}</td>
                          <td className="py-1.5 pr-2 text-right">{formatCentsBrl(row.cbsDebitCents)}</td>
                          <td className="py-1.5 pr-2 text-right">{formatCentsBrl(row.ibsDebitCents)}</td>
                          <td className="py-1.5 text-right">
                            {row.isInformativeOnly ? "ano-teste" : row.isInsideDas ? "dentro do DAS" : formatCentsBrl(row.totalDueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {isSimplesInsideDas && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    No Simples, CBS e IBS continuam dentro do DAS, a menos que você opte por recolher por fora
                    <FiscalTermHint termId="simples-por-fora" />.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
