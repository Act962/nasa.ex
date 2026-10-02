"use client";

import { useState } from "react";
import { ChevronDown, PartyPopper, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRegularityScore, useSetDocumentRequirement } from "@/features/accounting/hooks/use-accounting-compliance";
import { COMPANY_DOCUMENT_TYPES } from "@/features/accounting/lib/compliance/document-catalog";
import { MissingItemCard, type RegularityItemView } from "./missing-item-card";

interface MissingItemsListProps {
  requirementOverrides: Array<{ typeCode: string; isApplicable: boolean }>;
  onUpload: (typeCode: string, period?: string) => void;
}

export function MissingItemsList({ requirementOverrides, onUpload }: MissingItemsListProps) {
  const { data: score, isLoading } = useRegularityScore();
  const setRequirement = useSetDocumentRequirement();
  const [isDisabledListOpen, setIsDisabledListOpen] = useState(false);

  function changeApplicability(typeCode: string, isApplicable: boolean | null) {
    setRequirement.mutate(
      { typeCode, isApplicable },
      {
        onSuccess: () =>
          toast.success(isApplicable === false ? "Item desligado — não conta mais no score." : "Item reativado."),
        onError: (error) => toast.error(error.message || "Não foi possível alterar o item."),
      },
    );
  }

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;

  const pendingItems = ((score?.items ?? []) as RegularityItemView[])
    .filter((item) => item.status !== "OK")
    .sort((left, right) => right.impactBps - left.impactBps);
  // Desligados pelo dono + opcionais do catálogo (licença sanitária, AVCB...) que nascem desligados.
  const applicabilityByCode = new Map(requirementOverrides.map((override) => [override.typeCode, override.isApplicable]));
  const disabledTypes = COMPANY_DOCUMENT_TYPES.filter((documentType) => {
    const override = applicabilityByCode.get(documentType.code);
    if (override === false) return true;
    return !!documentType.applicability.isOptInOnly && override !== true;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">O que falta</CardTitle>
        <p className="text-sm text-muted-foreground">
          Em ordem do que mais aumenta o seu score. Resolva de cima para baixo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
            <PartyPopper className="size-8 text-info" />
            <p className="text-sm font-medium">Tudo em dia!</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Nenhum documento vencido ou faltando. Avisaremos aqui quando algo estiver perto de vencer.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pendingItems.map((item) => (
              <MissingItemCard
                key={item.typeCode}
                item={item}
                onUpload={onUpload}
                onDisable={(typeCode) => changeApplicability(typeCode, false)}
                isDisabling={setRequirement.isPending}
              />
            ))}
          </ul>
        )}

        {disabledTypes.length > 0 && (
          <div className="rounded-xl border bg-muted/30">
            <button
              type="button"
              onClick={() => setIsDisabledListOpen((isOpen) => !isOpen)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium"
            >
              Itens desligados e opcionais ({disabledTypes.length})
              <ChevronDown className={cn("size-4 transition-transform", isDisabledListOpen && "rotate-180")} />
            </button>
            {isDisabledListOpen && (
              <ul className="divide-y border-t">
                {disabledTypes.map((documentType) => (
                  <li key={documentType.code} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm">{documentType.label}</span>
                      <span className="block text-xs text-muted-foreground">{documentType.description}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={setRequirement.isPending}
                      onClick={() =>
                        changeApplicability(documentType.code, documentType.applicability.isOptInOnly ? true : null)
                      }
                    >
                      <RotateCcw className="size-3.5" /> {documentType.applicability.isOptInOnly ? "Ativar" : "Reativar"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
