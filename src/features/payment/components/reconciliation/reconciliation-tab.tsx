"use client";

import { useRef, useState } from "react";
import { Upload, FileCheck2, Landmark, Info, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePaymentAccounts } from "../../hooks/use-payment";
import {
  useImportStatement,
  useInspectStatement,
  useStatementTransactions,
} from "../../hooks/use-payment-statements";
import { describePaymentError } from "../../lib/describe-error";
import { formatCurrency, formatDate } from "../../lib/format";
import { TransactionsList } from "./transactions-list";

type StatusTab = "PENDING" | "MATCHED" | "IGNORED";

interface StatementInspection {
  bankId: string | null;
  bankName: string | null;
  statementAccountId: string | null;
  periodStart: Date | string | null;
  periodEnd: Date | string | null;
  transactionCount: number;
  suggestedAccountId: string | null;
  matchReason: "EXACT_ACCOUNT" | "BANK_CODE" | "ONLY_ACCOUNT" | "NONE";
}

interface PendingStatement {
  fileName: string;
  contentBase64: string;
  inspection: StatementInspection;
}

const MATCH_REASON_LABELS: Record<StatementInspection["matchReason"], string> = {
  EXACT_ACCOUNT: "Esta conta já recebeu extratos desta mesma conta bancária.",
  BANK_CODE: "Única conta cadastrada neste banco.",
  ONLY_ACCOUNT: "Você só tem uma conta cadastrada.",
  NONE: "Não consegui identificar a conta — escolha abaixo.",
};

const STATUS_LABELS: Record<StatusTab, string> = {
  PENDING: "A conciliar",
  MATCHED: "Conciliadas",
  IGNORED: "Ignoradas",
};

export function ReconciliationTab() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  // Arquivo já lido e aguardando confirmação do destino. Manter o conteúdo aqui
  // evita pedir o arquivo de novo entre a inspeção e a importação.
  const [pending, setPending] = useState<PendingStatement | null>(null);

  const { data: accountsData } = usePaymentAccounts();
  const accounts = accountsData?.accounts ?? [];
  const inspectStatement = useInspectStatement();
  const importStatement = useImportStatement();
  const { data, isLoading } = useStatementTransactions({
    accountId: accountId || undefined,
    status: statusTab,
  });

  const isBusy = inspectStatement.isPending || importStatement.isPending;

  async function handleFile(file: File) {
    try {
      // Lê como bytes e envia em base64: o encoding do extrato é detectado no
      // servidor a partir do cabeçalho, e deixar o navegador decodificar como
      // texto destruiria essa informação.
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const contentBase64 = btoa(binary);

      // Lê o cabeçalho antes de gravar: o arquivo diz de que conta ele é, e a
      // tela aponta a conta cadastrada correspondente para o usuário confirmar.
      const inspection = await inspectStatement.mutateAsync({ contentBase64 });
      if (inspection.suggestedAccountId) setAccountId(inspection.suggestedAccountId);
      setPending({ fileName: file.name, contentBase64, inspection });
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível ler o extrato"));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function confirmImport() {
    if (!pending) return;
    if (!accountId) return toast.error("Escolha a conta de destino");

    try {
      const result = await importStatement.mutateAsync({
        accountId,
        fileName: pending.fileName,
        contentBase64: pending.contentBase64,
      });
      setPending(null);

      if (result.alreadyImportedAt) {
        toast.info("Este mesmo arquivo já tinha sido importado antes — nada foi duplicado.");
      }
      toast.success(
        result.imported > 0
          ? `${result.imported} transação(ões) nova(s). ${result.duplicated} já existia(m).`
          : "Nenhuma transação nova — tudo neste extrato já havia sido importado.",
      );
      for (const warning of result.warnings.filter((w) => w.severity !== "info")) {
        toast.warning(warning.message);
      }
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível importar o extrato"));
    }
  }

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:w-64">
          <label className="text-xs text-muted-foreground">Filtrar por conta</label>
          <Select
            value={accountId || "__all__"}
            onValueChange={(value) => setAccountId(value === "__all__" ? "" : value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as contas</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".ofx,application/x-ofx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          onClick={() => fileInput.current?.click()}
          disabled={isBusy}
          className="h-9 gap-1.5 bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90"
        >
          <Upload className="size-4" />
          {inspectStatement.isPending
            ? "Lendo arquivo..."
            : importStatement.isPending
              ? "Importando..."
              : "Importar extrato (.ofx)"}
        </Button>
      </div>

      {pending && (
        <ConfirmImportCard
          pending={pending}
          accounts={accounts}
          accountId={accountId}
          onAccountChange={setAccountId}
          onConfirm={confirmImport}
          onCancel={() => setPending(null)}
          isImporting={importStatement.isPending}
        />
      )}

      {totals && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="gap-0 py-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-lg font-black text-green-400">
                {formatCurrency(totals.creditCents)}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-lg font-black text-red-400">
                {formatCurrency(totals.debitCents)}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Aguardando conciliação</p>
              <p className="text-lg font-black">{totals.pendingCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_LABELS) as StatusTab[]).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusTab === status ? "secondary" : "ghost"}
            className="h-8 text-xs"
            onClick={() => setStatusTab(status)}
          >
            {STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : (data?.transactions.length ?? 0) === 0 ? (
        <EmptyState hasAccount={Boolean(accountId)} status={statusTab} />
      ) : (
        <TransactionsList transactions={data!.transactions} status={statusTab} />
      )}
    </div>
  );
}

/**
 * O que o arquivo diz de si mesmo, com a conta de destino já apontada. Existe
 * para o usuário confirmar o destino antes de qualquer escrita — importar na
 * conta errada mistura dois extratos numa fila só.
 */
function ConfirmImportCard({
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
  const identified = inspection.matchReason !== "NONE";

  return (
    <Card className="gap-0 border-blue-500/30 py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {identified ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {inspection.bankName ?? "Extrato"}
                {inspection.statementAccountId ? ` · conta ${inspection.statementAccountId}` : ""}
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
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasAccount, status }: { hasAccount: boolean; status: StatusTab }) {
  if (status !== "PENDING") {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <FileCheck2 className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhuma transação {status === "MATCHED" ? "conciliada" : "ignorada"} ainda.
        </p>
      </div>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Landmark className="size-5 text-muted-foreground" />
          <p className="text-sm font-semibold">
            {hasAccount
              ? "Nenhuma transação aguardando conciliação"
              : "Escolha a conta e importe o extrato"}
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-400" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Como exportar no Nubank PJ</p>
            <p>
              No app: toque no saldo da conta → <strong>Exportar extrato</strong> → escolha
              o período → formato <strong>OFX</strong>. Dá para receber por e-mail ou salvar
              no aparelho. Na mesma tela é possível programar o envio recorrente.
            </p>
            <p>
              Importar o mesmo período duas vezes não duplica nada — cada transação tem um
              identificador próprio do banco.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
