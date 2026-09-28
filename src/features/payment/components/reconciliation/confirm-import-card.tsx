"use client";

import { CheckCircle2, Info, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "../../lib/format";

export interface StatementInspection {
  source: string;
  bankId: string | null;
  bankName: string | null;
  statementAccountId: string | null;
  periodStart: Date | string | null;
  periodEnd: Date | string | null;
  transactionCount: number;
  suggestedAccountId: string | null;
  matchReason: "EXACT_ACCOUNT" | "BANK_CODE" | "ONLY_ACCOUNT" | "NONE";
}

export type PendingStatement =
  | { format: "OFX"; fileName: string; contentBase64: string; inspection: StatementInspection }
  | { format: "PDF"; fileName: string; attachmentId: string; inspection: StatementInspection };

const MATCH_REASON_LABELS: Record<StatementInspection["matchReason"], string> = {
  EXACT_ACCOUNT: "Esta conta já recebeu extratos desta mesma conta bancária.",
  BANK_CODE: "Única conta cadastrada neste banco.",
  ONLY_ACCOUNT: "Você só tem uma conta cadastrada.",
  NONE: "Não consegui identificar a conta — escolha abaixo.",
};

/**
 * O que o arquivo diz de si mesmo, com a conta de destino já apontada. Existe
 * para o usuário confirmar o destino antes de qualquer escrita — importar na
 * conta errada mistura dois extratos numa fila só.
 */
export function ConfirmImportCard({
  pending,
  accounts,
  accountId,
  onAccountChange,
  onConfirm,
  onCancel,
  isImporting,
}: {
  pending: PendingStatement;
  accounts: Array<{ id: string; name: string }>;
  accountId: string;
  onAccountChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
}) {
  const { inspection } = pending;
  const isIdentified = inspection.matchReason !== "NONE";
  const isPdf = pending.format === "PDF";

  return (
    <Card className="gap-0 border-blue-500/30 py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {isIdentified ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                {inspection.bankName ?? "Extrato"}
                {inspection.statementAccountId ? ` · conta ${inspection.statementAccountId}` : ""}
                {isPdf && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300"
                  >
                    <Sparkles className="size-3" />
                    PDF lido por IA
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {inspection.transactionCount} transação(ões)
                {inspection.periodStart && inspection.periodEnd
                  ? ` · ${formatDate(inspection.periodStart)} a ${formatDate(inspection.periodEnd)}`
                  : ""}
                {` · ${pending.fileName}`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onCancel}
            aria-label="Descartar arquivo"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Importar para</label>
            <Select value={accountId} onValueChange={onAccountChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Escolher conta..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={onConfirm}
            disabled={isImporting || !accountId}
            className="h-9 bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90"
          >
            {isImporting ? "Importando..." : "Confirmar importação"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {MATCH_REASON_LABELS[inspection.matchReason]}
          {isPdf
            ? " Confira o número de transações com o PDF. A importação de extrato em PDF consome Stars."
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}
