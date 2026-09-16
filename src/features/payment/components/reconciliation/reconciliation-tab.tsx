"use client";

import { useRef, useState } from "react";
import { Upload, FileCheck2, Landmark, Info } from "lucide-react";
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
import { useUploadPaymentAttachment } from "../../hooks/use-payment-attachments";
import { describePaymentError } from "../../lib/describe-error";
import { formatCurrency } from "../../lib/format";
import { TransactionsList } from "./transactions-list";
import { ConfirmImportCard, type PendingStatement } from "./confirm-import-card";

type StatusTab = "PENDING" | "MATCHED" | "IGNORED";

const STATUS_LABELS: Record<StatusTab, string> = {
  PENDING: "A conciliar",
  MATCHED: "Conciliadas",
  IGNORED: "Ignoradas",
};

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

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
  const uploadAttachment = useUploadPaymentAttachment();
  const { data, isLoading } = useStatementTransactions({
    accountId: accountId || undefined,
    status: statusTab,
  });

  const isBusy = inspectStatement.isPending || importStatement.isPending || uploadAttachment.isPending;

  async function readPdfStatement(file: File) {
    // PDF sobe como anexo financeiro e é lido no servidor: o arquivo fica em
    // Documentos e a leitura por IA é reaproveitada na importação.
    const attachment = await uploadAttachment.mutateAsync(file);
    const inspection = await inspectStatement.mutateAsync({ attachmentId: attachment.id });
    if (inspection.suggestedAccountId) setAccountId(inspection.suggestedAccountId);
    setPending({ format: "PDF", fileName: file.name, attachmentId: attachment.id, inspection });
  }

  async function readOfxStatement(file: File) {
    // Lê como bytes e envia em base64: o encoding do extrato é detectado no
    // servidor a partir do cabeçalho, e deixar o navegador decodificar como
    // texto destruiria essa informação.
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const contentBase64 = btoa(binary);

    const inspection = await inspectStatement.mutateAsync({ contentBase64 });
    if (inspection.suggestedAccountId) setAccountId(inspection.suggestedAccountId);
    setPending({ format: "OFX", fileName: file.name, contentBase64, inspection });
  }

  async function handleFile(file: File) {
    try {
      if (isPdfFile(file)) await readPdfStatement(file);
      else await readOfxStatement(file);
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
      const result = await importStatement.mutateAsync(
        pending.format === "PDF"
          ? { accountId, fileName: pending.fileName, attachmentId: pending.attachmentId }
          : { accountId, fileName: pending.fileName, contentBase64: pending.contentBase64 },
      );
      setPending(null);

      if (result.alreadyImportedAt) {
        toast.info("Este mesmo arquivo já tinha sido importado antes — nada foi duplicado.");
      }
      toast.success(
        result.imported > 0
          ? `${result.imported} transação(ões) nova(s). ${result.duplicated} já existia(m).`
          : "Nenhuma transação nova — tudo neste extrato já havia sido importado.",
      );
      if (result.starsCharged > 0) {
        toast.info(`Leitura do extrato em PDF: ${result.starsCharged}★ consumidas.`);
      }
      for (const warning of result.warnings.filter((statementWarning) => statementWarning.severity !== "info")) {
        toast.warning(warning.message);
      }
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível importar o extrato"));
    }
  }

  const totals = data?.totals;
  const importButtonLabel = uploadAttachment.isPending
    ? "Enviando arquivo..."
    : inspectStatement.isPending
      ? "Lendo extrato..."
      : importStatement.isPending
        ? "Importando..."
        : "Importar extrato (.ofx ou .pdf)";

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
          accept=".ofx,.pdf,application/x-ofx,application/pdf"
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
          {importButtonLabel}
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
            <p>
              Só tem o extrato em <strong>PDF</strong>? Também dá para importar: a IA lê as
              movimentações (consome Stars). Prefira o OFX quando o banco oferecer — é exato.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
