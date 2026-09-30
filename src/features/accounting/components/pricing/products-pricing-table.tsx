"use client";

import { useState } from "react";
import { Package, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAssignProductClassification,
  useTaxClassifications,
} from "@/features/accounting/hooks/use-accounting-pricing";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { ClassificationFormDialog } from "./classification-form-dialog";

const NO_CLASSIFICATION = "NONE";
const CREATE_CLASSIFICATION = "CREATE";

export interface PricedProductRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
  priceCents: number;
  classificationId: string | null;
  classificationName: string | null;
  kind: "PRODUCT" | "SERVICE";
  rateBps: number;
  taxPerUnitCents: number;
  netCents: number;
  alerts: string[];
}

/** Produtos do Forge com classificação, imposto por unidade e quanto sobra. */
export function ProductsPricingTable({ products }: { products: PricedProductRow[] }) {
  const classificationsQuery = useTaxClassifications();
  const assignClassification = useAssignProductClassification();
  const [productAwaitingNewClassification, setProductAwaitingNewClassification] = useState<string | null>(null);
  const classifications = classificationsQuery.data?.classifications ?? [];

  function assign(productId: string, classificationId: string | null) {
    assignClassification.mutate(
      { productId, classificationId },
      {
        onSuccess: () => toast.success("Classificação atribuída."),
        onError: (error) => toast.error(error.message || "Não foi possível atribuir."),
      },
    );
  }

  function handleSelect(productId: string, value: string) {
    if (value === CREATE_CLASSIFICATION) {
      setProductAwaitingNewClassification(productId);
      return;
    }
    assign(productId, value === NO_CLASSIFICATION ? null : value);
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Produtos e serviços do Forge</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quanto de cada preço vai para imposto <FiscalTermHint termId="aliquota-efetiva" /> e quanto sobra para você.
        </p>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <Package className="size-5 text-violet-500" />
            <p>Nenhum produto cadastrado no Forge ainda. Cadastre o que você vende para ver o imposto de cada preço.</p>
            <Button asChild size="sm" variant="outline">
              <a href="/forge">Abrir o Forge</a>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">Classificação</th>
                  <th className="px-3 py-2 text-right font-medium">Preço</th>
                  <th className="px-3 py-2 text-right font-medium">Imposto / un.</th>
                  <th className="py-2 pl-3 text-right font-medium">Sobra / un.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => (
                  <tr key={product.id} className="align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} · {product.unit}
                      </p>
                      {product.alerts.map((alert) => (
                        <p key={alert} className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                          <TriangleAlert className="size-3 shrink-0" />
                          {alert}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={product.classificationId ?? NO_CLASSIFICATION}
                        onValueChange={(value) => handleSelect(product.id, value)}
                        disabled={assignClassification.isPending}
                      >
                        <SelectTrigger className="h-8 w-[200px] text-xs" aria-label={`Classificação de ${product.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CLASSIFICATION}>Sem classificação</SelectItem>
                          {classifications.map((classification) => (
                            <SelectItem key={classification.id} value={classification.id}>
                              {classification.name}
                            </SelectItem>
                          ))}
                          <SelectItem value={CREATE_CLASSIFICATION}>+ Criar nova…</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(product.priceCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCentsBrl(product.taxPerUnitCents)}
                      <p className="text-[11px] text-muted-foreground">{formatBps(product.rateBps)}</p>
                    </td>
                    <td className="py-2 pl-3 text-right font-medium tabular-nums">{formatCentsBrl(product.netCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <ClassificationFormDialog
        open={productAwaitingNewClassification !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setProductAwaitingNewClassification(null);
        }}
        classification={null}
        onSaved={(classificationId) => {
          if (productAwaitingNewClassification) assign(productAwaitingNewClassification, classificationId);
        }}
      />
    </Card>
  );
}
