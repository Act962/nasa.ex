"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSetSupplierRegime, useSupplierCreditRanking } from "@/features/accounting/hooks/use-accounting-credits";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { REGIME_LABELS, REGIME_TERM_IDS, type TaxRegimeDisplay } from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { formatDocument } from "./credit-display";

const UNKNOWN_REGIME = "UNKNOWN";
const REGIME_OPTIONS = Object.keys(REGIME_LABELS) as TaxRegimeDisplay[];

function RegimeBadge({ taxRegime }: { taxRegime: TaxRegimeDisplay | null }) {
  if (!taxRegime) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Regime desconhecido
      </Badge>
    );
  }
  const isSimplesLike = taxRegime === "SIMPLES" || taxRegime === "MEI";
  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        className={cn(
          "font-normal",
          isSimplesLike && "border-warning/40 bg-warning/10 text-warning dark:text-warning",
        )}
      >
        {REGIME_LABELS[taxRegime]}
      </Badge>
      <FiscalTermHint termId={REGIME_TERM_IDS[taxRegime]} />
    </span>
  );
}

/** Quanto cada fornecedor devolve em crédito — e quem está vendendo sem nota. */
export function SupplierRanking() {
  const rankingQuery = useSupplierCreditRanking();
  const setSupplierRegime = useSetSupplierRegime();
  const suppliers = rankingQuery.data?.suppliers ?? [];

  function handleRegimeChange(contactId: string, value: string) {
    setSupplierRegime.mutate(
      { contactId, taxRegime: value === UNKNOWN_REGIME ? null : (value as TaxRegimeDisplay) },
      {
        onSuccess: () => toast.success("Regime do fornecedor atualizado."),
        onError: (error) => toast.error(error.message || "Não foi possível salvar o regime."),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Fornecedores x crédito (últimos 12 meses)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quanto você comprou de cada um e quanto disso voltou como crédito. Fornecedor do Simples ou MEI tende a gerar
          menos crédito — negocie o preço levando isso em conta.
        </p>
      </CardHeader>
      <CardContent>
        {rankingQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rankingQuery.isError ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar o ranking agora.</p>
        ) : suppliers.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            Ainda não há compras com fornecedor cadastrado nos últimos 12 meses. Ao lançar uma Despesa, escolha o
            fornecedor (contato) para ele aparecer aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Fornecedor</th>
                  <th className="px-3 py-2 text-right font-medium">Comprado</th>
                  <th className="px-3 py-2 text-right font-medium">Crédito gerado</th>
                  <th className="px-3 py-2 text-right font-medium">Crédito / compra</th>
                  <th className="py-2 pl-3 text-left font-medium">Regime</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suppliers.map((supplier) => (
                  <tr key={supplier.contactId ?? `${supplier.document}-${supplier.name}`}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDocument(supplier.document)}</p>
                      {supplier.entriesWithoutInvoiceCount > 0 && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-destructive/40 bg-destructive/10 font-normal text-destructive dark:text-destructive"
                        >
                          {supplier.entriesWithoutInvoiceCount} de {supplier.entryCount} sem nota
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(supplier.purchasedCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(supplier.creditCents)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        supplier.creditRatioBps === 0 && "text-muted-foreground",
                      )}
                    >
                      {formatBps(supplier.creditRatioBps)}
                    </td>
                    <td className="py-2 pl-3">
                      {supplier.contactId ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <RegimeBadge taxRegime={supplier.taxRegime} />
                          <Select
                            value={supplier.taxRegime ?? UNKNOWN_REGIME}
                            onValueChange={(value) => handleRegimeChange(supplier.contactId as string, value)}
                            disabled={setSupplierRegime.isPending}
                          >
                            <SelectTrigger className="h-7 w-[160px] text-xs" aria-label={`Regime de ${supplier.name}`}>
                              <SelectValue placeholder="Definir regime" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNKNOWN_REGIME}>Não sei</SelectItem>
                              {REGIME_OPTIONS.map((regime) => (
                                <SelectItem key={regime} value={regime}>
                                  {REGIME_LABELS[regime]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem cadastro no financeiro</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
