"use client";

import { useState } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useReprocessJournal } from "@/features/accounting/hooks/use-accounting-ledger";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { toErrorMessage } from "../chart/account-code";
import { BalanceSheetView } from "./balance-sheet-view";
import { LedgerSheet } from "./ledger-sheet";
import { TrialBalanceView } from "./trial-balance-view";
import { resolvePresetPeriod, type ReportPeriod, type ReportPeriodPreset } from "./report-period";

const PRESET_OPTIONS: Array<{ id: Exclude<ReportPeriodPreset, "custom">; label: string }> = [
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "this_year", label: "Este ano" },
];

/** Seção "Balancete e balanço": relatórios gerados a partir dos lançamentos do financeiro. */
export function LedgerReportsSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [preset, setPreset] = useState<ReportPeriodPreset>("this_month");
  const [period, setPeriod] = useState<ReportPeriod>(() => resolvePresetPeriod("this_month"));
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null);
  const [isReprocessDialogOpen, setIsReprocessDialogOpen] = useState(false);
  const reprocessJournal = useReprocessJournal();

  function handlePresetClick(presetId: Exclude<ReportPeriodPreset, "custom">) {
    setPreset(presetId);
    setPeriod(resolvePresetPeriod(presetId));
  }

  function handleCustomDateChange(edge: keyof ReportPeriod, isoDate: string) {
    if (!isoDate) return;
    setPreset("custom");
    setPeriod((current) => {
      const next = { ...current, [edge]: isoDate };
      return next.from <= next.to ? next : { from: isoDate, to: isoDate };
    });
  }

  function handleReprocess() {
    reprocessJournal.mutate(
      {},
      {
        onSuccess: () => {
          toast.success("Reprocessamento iniciado. Os relatórios se atualizam em alguns instantes.");
          setIsReprocessDialogOpen(false);
        },
        onError: (error) => toast.error(toErrorMessage(error, "Não foi possível iniciar o reprocessamento.")),
      },
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-info/5 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Scale className="size-4 text-info" />
            Balancete, razão e balanço
          </p>
          <p className="text-muted-foreground">
            Montados sozinhos a partir do que você lança em Receita e Despesa. O balancete mostra quanto passou por cada
            conta; o balanço mostra o que a empresa tem, o que deve e o que é dos sócios.
          </p>
          {onNavigate && (
            <Button type="button" variant="link" size="sm" className="h-auto px-0 text-info" onClick={() => onNavigate("chart")}>
              Ver plano de contas e mapeamento
            </Button>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setIsReprocessDialogOpen(true)}>
          <RefreshCw className="size-3.5" />
          Reprocessar contabilidade
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex gap-1 overflow-x-auto">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={preset === option.id}
              onClick={() => handlePresetClick(option.id)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                preset === option.id
                  ? "border-info/40 bg-info/10 text-info dark:text-info"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="space-y-1">
            <Label htmlFor="report-period-from" className="text-xs text-muted-foreground">
              De
            </Label>
            <Input
              id="report-period-from"
              type="date"
              value={period.from}
              onChange={(event) => handleCustomDateChange("from", event.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-period-to" className="text-xs text-muted-foreground">
              Até
            </Label>
            <Input
              id="report-period-to"
              type="date"
              value={period.to}
              onChange={(event) => handleCustomDateChange("to", event.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trial-balance" className="gap-1">
            Balancete
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="gap-1">
            Balanço
          </TabsTrigger>
        </TabsList>
        <TabsContent value="trial-balance">
          <TrialBalanceView
            period={period}
            onOpenLedger={setLedgerAccountId}
            onRequestReprocess={() => setIsReprocessDialogOpen(true)}
          />
        </TabsContent>
        <TabsContent value="balance-sheet">
          <BalanceSheetView at={period.to} />
        </TabsContent>
      </Tabs>

      <LedgerSheet accountId={ledgerAccountId} period={period} onClose={() => setLedgerAccountId(null)} />

      <AlertDialog open={isReprocessDialogOpen} onOpenChange={setIsReprocessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprocessar a contabilidade?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O sistema refaz todos os lançamentos contábeis a partir do financeiro, do zero. Nada do que você lançou
                  em Receita e Despesa é alterado.
                </p>
                <p>
                  Use quando os relatórios parecerem desatualizados, depois de importar lançamentos antigos ou quando o
                  balancete não fechar. Roda em segundo plano e pode levar alguns minutos.
                </p>
                <p className="inline-flex items-center gap-1">
                  Entenda o balancete
                  <FiscalTermHint termId="balancete" />
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reprocessJournal.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              onClick={handleReprocess}
              disabled={reprocessJournal.isPending}
              className="gap-1.5 bg-info text-white hover:bg-info"
            >
              {reprocessJournal.isPending && <OrbitaSpinner className="size-4 " />}
              Reprocessar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
