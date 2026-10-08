"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, LockOpen, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  useCloseFormPeriod,
  useFormClosing,
  useGenerateClosingReceivables,
  useReopenFormPeriod,
  useSaveClosingSharedCosts,
} from "@/features/form-records/hooks/use-form-closings";
import { groupLinesForBilling, type SharedCostGroup } from "@/features/form-records/lib/compute-closing";
import { formatCents } from "@/features/form-records/lib/measure-units";
import { toPeriodKey } from "@/features/form-records/lib/record-fields";
import { formatPeriodKey } from "./form-records-section";
import { SharedCostGroupsEditor } from "./shared-cost-groups-editor";

function readErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Não deu certo. Tente de novo.";
}

/** Fechamento de um período por cliente (spec 0075, RF-10). */
export function FormClosingPage({ formId }: { formId: string }) {
  const [periodKey, setPeriodKey] = useState(() => toPeriodKey(new Date()));
  const { data, isLoading, isError } = useFormClosing({ formId, periodKey });
  const [groups, setGroups] = useState<SharedCostGroup[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const saveSharedCosts = useSaveClosingSharedCosts();
  const closePeriod = useCloseFormPeriod();
  const reopenPeriod = useReopenFormPeriod();
  const generateReceivables = useGenerateClosingReceivables();

  // O que veio do servidor substitui o rascunho local só quando não há edição pendente.
  useEffect(() => {
    if (data && !isDirty) setGroups(data.groups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const changePeriod = (nextPeriodKey: string) => {
    setIsDirty(false);
    setPeriodKey(nextPeriodKey);
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-3 text-muted-foreground">
        <OrbitaSpinner className="size-8 text-primary/50" />
        <p className="text-sm">Carregando fechamento...</p>
      </div>
    );
  }
  if (isError || !data) {
    return <p className="rounded-md border p-6 text-sm text-muted-foreground">Não consegui carregar o fechamento. Recarregue a página.</p>;
  }

  const isClosed = data.status === "CLOSED";
  const periodOptions = [...new Set([periodKey, toPeriodKey(new Date()), ...data.periodKeys])].sort().reverse();
  // Uma conta por grupo de cobrança: o titular com os vinculados "no titular", e cada vinculado de cobrança própria.
  const pendingReceivables = groupLinesForBilling(data.lines).filter((group) => !group.lines[0].paymentEntryId && group.totalCents > 0).length;
  const isBusy = saveSharedCosts.isPending || closePeriod.isPending || reopenPeriod.isPending || generateReceivables.isPending;
  const canClose = !isClosed && !isDirty && data.lines.length > 0 && data.withoutClientCount === 0;

  const handleSave = () =>
    saveSharedCosts.mutate(
      { formId, periodKey, groups },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast.success("Custos salvos.");
        },
        onError: (error) => toast.error(readErrorMessage(error)),
      },
    );

  return (
    <main className="space-y-6 pt-5 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link href={`/form/responses/${formId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Voltar para as fichas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Fechamento · {data.formName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodKey} onValueChange={changePeriod}>
            <SelectTrigger className="w-52" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((key) => (
                <SelectItem key={key} value={key}>
                  {formatPeriodKey(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant={isClosed ? "secondary" : "outline"}>
            {isClosed ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            {isClosed ? "Fechado" : "Aberto"}
          </Badge>
        </div>
      </div>

      {(data.draftCount > 0 || data.withoutClientCount > 0) && (
        <div className="space-y-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          {data.draftCount > 0 && (
            <p>
              {data.draftCount} ficha(s) em rascunho neste período não entram na conta. Envie-as antes de fechar, se devem entrar.
            </p>
          )}
          {data.withoutClientCount > 0 && (
            <p>{data.withoutClientCount} ficha(s) sem cliente. Não é possível fechar enquanto existirem.</p>
          )}
        </div>
      )}

      <section className="space-y-3" aria-label="Custos compartilhados">
        <div>
          <h2 className="text-lg font-semibold">Custos compartilhados do período</h2>
          <p className="text-sm text-muted-foreground">
            O total de cada grupo é dividido entre os clientes pelo número de fichas de cada um.
          </p>
        </div>
        <SharedCostGroupsEditor
          groups={groups}
          isReadOnly={isClosed}
          onChange={(nextGroups) => {
            setGroups(nextGroups);
            setIsDirty(true);
          }}
        />
        {!isClosed && (
          <Button onClick={handleSave} disabled={!isDirty || isBusy}>
            {saveSharedCosts.isPending ? "Salvando..." : "Salvar custos"}
          </Button>
        )}
      </section>

      <section className="space-y-3" aria-label="Total por cliente">
        <div>
          <h2 className="text-lg font-semibold">Total por cliente</h2>
          <p className="text-sm text-muted-foreground">
            {isClosed ? "Valores gravados no fechamento." : "Prévia calculada com as fichas enviadas e os custos salvos."}
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Fichas</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Custos rateados</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {isClosed && <TableHead>Conta a receber</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isClosed ? 6 : 5} className="h-24 text-center text-muted-foreground">
                    Nenhuma ficha enviada neste período.
                  </TableCell>
                </TableRow>
              ) : (
                data.lines.map((line) => (
                  <TableRow key={`${line.leadId}|${line.leadMemberId}`}>
                    <TableCell>
                      {line.leadMemberName ? (
                        <span className="flex flex-wrap items-center gap-2 pl-4">
                          <span className="text-muted-foreground">↳ {line.leadName} ·</span>
                          <span>{line.leadMemberName}</span>
                          {line.billingMode === "PROPRIO" && <Badge variant="outline">Conta própria</Badge>}
                        </span>
                      ) : (
                        line.leadName
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.recordCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(line.usageCents)}</TableCell>
                    <TableCell
                      className="text-right tabular-nums"
                      title={line.shares.map((share) => `${share.name}: ${formatCents(share.cents)}`).join(" · ")}
                    >
                      {formatCents(line.sharedCostCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCents(line.totalCents)}</TableCell>
                    {isClosed && <TableCell>{line.paymentEntryId ? "Gerada" : "Não gerada"}</TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
            {data.lines.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Total</TableCell>
                  <TableCell className="text-right tabular-nums">{data.totalRecords}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(data.usageCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(data.sharedCostCents)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCents(data.totalCents)}</TableCell>
                  {isClosed && <TableCell />}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {!isClosed && (
          <Button
            disabled={!canClose || isBusy}
            onClick={() =>
              closePeriod.mutate(
                { formId, periodKey },
                {
                  onSuccess: () => toast.success("Período fechado. As fichas deste período ficaram travadas."),
                  onError: (error) => toast.error(readErrorMessage(error)),
                },
              )
            }
          >
            <Lock className="size-4" />
            {closePeriod.isPending ? "Fechando..." : isDirty ? "Salve os custos antes de fechar" : "Fechar período"}
          </Button>
        )}
        {isClosed && (
          <>
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() =>
                reopenPeriod.mutate(
                  { formId, periodKey },
                  {
                    onSuccess: () => toast.success("Período reaberto."),
                    onError: (error) => toast.error(readErrorMessage(error)),
                  },
                )
              }
            >
              <LockOpen className="size-4" />
              Reabrir
            </Button>
            <Button
              disabled={pendingReceivables === 0 || isBusy}
              onClick={() =>
                generateReceivables.mutate(
                  { formId, periodKey },
                  {
                    onSuccess: (result) =>
                      result.failedCount > 0
                        ? toast.error(`${result.createdCount} conta(s) gerada(s), ${result.failedCount} falharam. Tente de novo para as que faltam.`)
                        : toast.success(`${result.createdCount} conta(s) a receber gerada(s) no Financeiro.`),
                    onError: (error) => toast.error(readErrorMessage(error)),
                  },
                )
              }
            >
              <Receipt className="size-4" />
              {generateReceivables.isPending
                ? "Gerando..."
                : pendingReceivables === 0
                  ? "Contas a receber já geradas"
                  : `Gerar ${pendingReceivables} conta(s) a receber`}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
