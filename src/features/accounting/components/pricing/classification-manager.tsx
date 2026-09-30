"use client";

import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteTaxClassification,
  useTaxClassifications,
} from "@/features/accounting/hooks/use-accounting-pricing";
import { formatBps } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { ClassificationFormDialog, type TaxClassificationRecord } from "./classification-form-dialog";

function describeCodes(classification: TaxClassificationRecord): string {
  const codes = [
    classification.ncm && `NCM ${classification.ncm}`,
    classification.nbs && `NBS ${classification.nbs}`,
    classification.lc116Item && `LC 116 item ${classification.lc116Item}`,
    classification.cClassTrib && `cClassTrib ${classification.cClassTrib}`,
  ].filter(Boolean);
  return codes.length > 0 ? codes.join(" · ") : "Sem códigos fiscais ainda";
}

/** CRUD das classificações tributárias (NCM/NBS/cClassTrib) usadas pelos produtos. */
export function ClassificationManager() {
  const classificationsQuery = useTaxClassifications();
  const deleteClassification = useDeleteTaxClassification();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClassification, setEditingClassification] = useState<TaxClassificationRecord | null>(null);
  const classifications = classificationsQuery.data?.classifications ?? [];

  function openCreate() {
    setEditingClassification(null);
    setIsDialogOpen(true);
  }

  function openEdit(classification: TaxClassificationRecord) {
    setEditingClassification(classification);
    setIsDialogOpen(true);
  }

  function handleDelete(classification: TaxClassificationRecord & { productCount: number }) {
    const warning =
      classification.productCount > 0
        ? `\n\n${classification.productCount} produto(s) ficarão sem classificação.`
        : "";
    if (!window.confirm(`Remover a classificação "${classification.name}"?${warning}`)) return;
    deleteClassification.mutate(
      { id: classification.id },
      {
        onSuccess: () => toast.success("Classificação removida."),
        onError: (error) => toast.error(error.message || "Não foi possível remover."),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-1.5 text-base">
            Classificações tributárias
            <FiscalTermHint termId="cclasstrib" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">Crie uma para cada tipo de item que você vende.</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700" onClick={openCreate}>
          <Plus className="size-3.5" />
          Nova classificação
        </Button>
      </CardHeader>
      <CardContent>
        {classificationsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : classificationsQuery.isError ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar as classificações agora.</p>
        ) : classifications.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            <Tags className="size-5 text-violet-500" />
            <p>
              Nenhuma classificação ainda. Comece pela principal coisa que você vende (ex.: “Consultoria” ou “Revenda
              de peças”) — dá para completar os códigos depois.
            </p>
            <Button size="sm" variant="outline" onClick={openCreate}>
              Criar a primeira
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {classifications.map((classification) => (
              <li key={classification.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {classification.name}
                    <Badge variant="outline" className="font-normal">
                      {classification.kind === "PRODUCT" ? "Produto" : "Serviço"}
                    </Badge>
                    {classification.reductionBps > 0 && (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-300">
                        Redução {formatBps(classification.reductionBps, 0)}
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {describeCodes(classification)} · {classification.productCount} produto(s)
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => openEdit(classification)}>
                    <Pencil className="size-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(classification)}
                    disabled={deleteClassification.isPending}
                  >
                    <Trash2 className="size-3.5" />
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ClassificationFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        classification={editingClassification}
      />
    </Card>
  );
}
