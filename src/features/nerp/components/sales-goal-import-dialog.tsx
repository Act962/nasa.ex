"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import {
  parseSalesGoalWorkbook,
  type ParsedSalesGoalWorkbook,
  type SalesGoalPeriodType,
} from "../lib/sales-goal-xlsx-parser";
import { useImportSalesGoalRanking } from "../hooks/use-nerp-ranking";

const PERIOD_TYPE_OPTIONS: { value: SalesGoalPeriodType; label: string }[] = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

type Step = "upload" | "preview" | "importing" | "done";

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface SalesGoalImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalesGoalImportDialog({ open, onOpenChange }: SalesGoalImportDialogProps) {
  const mutation = useImportSalesGoalRanking();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedSalesGoalWorkbook | null>(null);
  const [periodType, setPeriodType] = useState<SalesGoalPeriodType>("MONTHLY");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName(null);
    setParsed(null);
    setError(null);
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const result = await parseSalesGoalWorkbook(file);
      if (result.branches.length === 0) {
        setError("Nenhuma filial foi reconhecida na planilha. Confira o formato do arquivo.");
        return;
      }
      setParsed(result);
      setPeriodType(result.periodType);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler a planilha.");
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const totalEntries = parsed?.branches.reduce((total, branch) => total + branch.entries.length, 0) ?? 0;

  const handleImport = () => {
    if (!parsed) return;
    setStep("importing");
    setError(null);

    mutation.mutate(
      {
        periodType,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        label: parsed.label ?? undefined,
        sourceFileName: fileName ?? undefined,
        branches: parsed.branches.map((branch) => ({
          name: branch.name,
          entries: branch.entries,
        })),
      },
      {
        onSuccess: () => setStep("done"),
        onError: (mutationError) => {
          setError(mutationError.message);
          setStep("preview");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            Importar planilha de metas
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Envie a planilha de metas exportada do Winthor (XLS/XLSX)."}
            {step === "preview" && "Confira os dados detectados antes de confirmar o import."}
            {step === "importing" && "Importando metas..."}
            {step === "done" && "Import concluído!"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground mb-1">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">Formatos aceitos: XLS, XLSX</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xls,.xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          )}

          {step === "preview" && parsed && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-foreground">Granularidade do período</label>
                  <Select value={periodType} onValueChange={(value) => setPeriodType(value as SalesGoalPeriodType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground pt-5">
                  {parsed.periodStart} → {parsed.periodEnd}
                </div>
              </div>

              {parsed.warnings.length > 0 && (
                <div className="flex flex-col gap-1.5 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-900">
                  {parsed.warnings.map((warning) => (
                    <div key={warning} className="flex items-start gap-2 text-xs text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {parsed.branches.map((branch) => (
                  <div key={branch.name} className="rounded-md border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {branch.entries.length} linhas ·{" "}
                        {formatBrl(branch.entries.reduce((sum, entry) => sum + entry.goalAmount, 0))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {branch.entries.map((entry) => (
                        <Badge
                          key={entry.externalCode}
                          variant={entry.entryKind === "BUCKET" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {entry.externalCode} · {entry.sellerName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Total: <strong className="text-foreground">{totalEntries}</strong> metas em{" "}
                <strong className="text-foreground">{parsed.branches.length}</strong> filiais.
              </p>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importando {totalEntries} metas...</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Metas importadas com sucesso
                </p>
                <p className="text-xs text-green-700 dark:text-green-200 mt-1">
                  O ranking já está atualizado com os novos dados.
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-3">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-x-2">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleImport}>
                Importar {totalEntries} metas <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
