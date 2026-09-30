"use client";

import { FilePlus2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMissingInvoices } from "@/features/accounting/hooks/use-accounting-credits";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { PAYABLES_TAB_HREF } from "./credit-display";

/** Despesas pagas nos últimos 3 meses sem nota anexada — o crédito que está escapando. */
export function MissingInvoices() {
  const missingQuery = useMissingInvoices();

  if (missingQuery.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (missingQuery.isError || !missingQuery.data) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          Não foi possível calcular o crédito perdido agora.
        </CardContent>
      </Card>
    );
  }

  const missing = missingQuery.data;
  const rateLabel = `${formatBps(missing.rateBps)}${missing.isEstimated ? " (estimada)" : ""}`;

  return (
    <Card className="border-red-500/20">
      <CardHeader className="space-y-1">
        <CardTitle className="flex flex-wrap items-center gap-1.5 text-base">
          Crédito perdido: despesas pagas sem nota
          <FiscalTermHint termId="credito-nao-cumulativo" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {missing.isFutureReference ? (
            <>
              Valendo <strong>a partir de {missing.referenceYear}</strong>: com CBS + IBS de {rateLabel}, estas compras
              deixariam de gerar cerca de{" "}
              <strong className="text-red-600 dark:text-red-400">
                {formatCentsBrl(missing.totalEstimatedCreditCents)}
              </strong>{" "}
              de crédito. Hoje é só um alerta: comece a pedir a nota já.
            </>
          ) : (
            <>
              Com CBS + IBS de {rateLabel}, estas compras poderiam ter gerado cerca de{" "}
              <strong className="text-red-600 dark:text-red-400">
                {formatCentsBrl(missing.totalEstimatedCreditCents)}
              </strong>{" "}
              de crédito.
            </>
          )}{" "}
          Estimativa pelo valor pago; fornecedor do Simples/MEI gera menos. Impostos e taxas ficam de fora.
        </p>
      </CardHeader>
      <CardContent>
        {missing.items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <PartyPopper className="size-4 text-emerald-500" />
            Todas as despesas pagas nos últimos 3 meses têm nota ou recibo. Continue assim!
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left font-medium">Despesa</th>
                    <th className="px-3 py-2 text-left font-medium">Pago em</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-3 py-2 text-right font-medium">Crédito estimado</th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {missing.items.map((item) => (
                    <tr key={item.entryId}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {[item.supplierName, item.categoryName].filter(Boolean).join(" · ") || "Sem fornecedor"}
                        </p>
                      </td>
                      <td className="px-3 py-2">{new Date(item.paidAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(item.amountCents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                        {formatCentsBrl(item.estimatedCreditCents)}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                          <a href={PAYABLES_TAB_HREF}>
                            <FilePlus2 className="size-3.5" />
                            Anexar nota
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Peça a nota ao fornecedor e anexe o XML no lançamento (aba Despesa). O crédito é registrado na hora.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
