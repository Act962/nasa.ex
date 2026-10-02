"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateTaxClassification,
  useUpdateTaxClassification,
} from "@/features/accounting/hooks/use-accounting-pricing";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

export interface TaxClassificationRecord {
  id: string;
  name: string;
  kind: "PRODUCT" | "SERVICE";
  ncm: string | null;
  nbs: string | null;
  lc116Item: string | null;
  cClassTrib: string | null;
  cst: string | null;
  reductionBps: number;
  issMunicipioIbge: string | null;
  issRateBps: number | null;
}

type ReductionBps = 0 | 3000 | 6000 | 10000;

const REDUCTION_OPTIONS: Array<{ value: ReductionBps; label: string }> = [
  { value: 0, label: "Sem redução (alíquota cheia)" },
  { value: 3000, label: "Redução de 30% (profissões regulamentadas)" },
  { value: 6000, label: "Redução de 60% (saúde, educação, alimentos...)" },
  { value: 10000, label: "Redução de 100% (alíquota zero)" },
];

interface ClassificationFormState {
  name: string;
  kind: "PRODUCT" | "SERVICE";
  ncm: string;
  nbs: string;
  lc116Item: string;
  cClassTrib: string;
  cst: string;
  reductionBps: ReductionBps;
  issMunicipioIbge: string;
  issRatePercent: string;
}

function toFormState(classification: TaxClassificationRecord | null): ClassificationFormState {
  const reduction = REDUCTION_OPTIONS.find((option) => option.value === classification?.reductionBps)?.value ?? 0;
  return {
    name: classification?.name ?? "",
    kind: classification?.kind ?? "SERVICE",
    ncm: classification?.ncm ?? "",
    nbs: classification?.nbs ?? "",
    lc116Item: classification?.lc116Item ?? "",
    cClassTrib: classification?.cClassTrib ?? "",
    cst: classification?.cst ?? "",
    reductionBps: reduction,
    issMunicipioIbge: classification?.issMunicipioIbge ?? "",
    issRatePercent: classification?.issRateBps != null ? String(classification.issRateBps / 100).replace(".", ",") : "",
  };
}

function percentTextToBps(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return null;
  const percent = Number(normalized);
  return Number.isFinite(percent) ? Math.round(percent * 100) : null;
}

interface ClassificationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classification: TaxClassificationRecord | null;
  onSaved?: (classificationId: string) => void;
}

export function ClassificationFormDialog({ open, onOpenChange, classification, onSaved }: ClassificationFormDialogProps) {
  const [formState, setFormState] = useState<ClassificationFormState>(() => toFormState(classification));
  const createClassification = useCreateTaxClassification();
  const updateClassification = useUpdateTaxClassification();
  const isSaving = createClassification.isPending || updateClassification.isPending;

  useEffect(() => {
    if (open) setFormState(toFormState(classification));
  }, [open, classification]);

  function updateField<Key extends keyof ClassificationFormState>(key: Key, value: ClassificationFormState[Key]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formState.name.trim()) {
      toast.error("Dê um nome à classificação (ex.: Consultoria, Revenda de peças).");
      return;
    }
    const payload = {
      name: formState.name.trim(),
      kind: formState.kind,
      ncm: formState.ncm.replace(/\D/g, "") || null,
      nbs: formState.nbs.trim() || null,
      lc116Item: formState.lc116Item.trim() || null,
      cClassTrib: formState.cClassTrib.replace(/\D/g, "") || null,
      cst: formState.cst.replace(/\D/g, "") || null,
      reductionBps: formState.reductionBps,
      issMunicipioIbge: formState.issMunicipioIbge.replace(/\D/g, "") || null,
      issRateBps: percentTextToBps(formState.issRatePercent),
    };
    const handlers = {
      onError: (error: Error) => toast.error(error.message || "Não foi possível salvar a classificação."),
    };
    if (classification) {
      updateClassification.mutate(
        { ...payload, id: classification.id },
        {
          ...handlers,
          onSuccess: () => {
            toast.success("Classificação atualizada.");
            onSaved?.(classification.id);
            onOpenChange(false);
          },
        },
      );
      return;
    }
    createClassification.mutate(payload, {
      ...handlers,
      onSuccess: (created) => {
        toast.success("Classificação criada.");
        onSaved?.(created.id);
        onOpenChange(false);
      },
    });
  }

  const isProduct = formState.kind === "PRODUCT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{classification ? "Editar classificação" : "Nova classificação tributária"}</DialogTitle>
          <DialogDescription>
            Agrupe itens que pagam imposto do mesmo jeito. Os códigos ficam na nota fiscal — peça ao seu contador se não
            souber algum; dá para salvar só com o nome.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="classification-name">Nome</Label>
              <Input
                id="classification-name"
                value={formState.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ex.: Consultoria em marketing"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={formState.kind} onValueChange={(value) => updateField("kind", value as "PRODUCT" | "SERVICE")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVICE">Serviço</SelectItem>
                  <SelectItem value="PRODUCT">Produto (mercadoria)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isProduct ? (
              <div className="space-y-1.5">
                <Label htmlFor="classification-ncm" className="flex items-center gap-1">
                  NCM <FiscalTermHint termId="ncm" />
                </Label>
                <Input
                  id="classification-ncm"
                  inputMode="numeric"
                  maxLength={10}
                  value={formState.ncm}
                  onChange={(event) => updateField("ncm", event.target.value)}
                  placeholder="8 dígitos"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="classification-nbs" className="flex items-center gap-1">
                  NBS <FiscalTermHint termId="nbs" />
                </Label>
                <Input
                  id="classification-nbs"
                  value={formState.nbs}
                  onChange={(event) => updateField("nbs", event.target.value)}
                  placeholder="Ex.: 1.1403.10.00"
                />
              </div>
            )}
            {!isProduct && (
              <div className="space-y-1.5">
                <Label htmlFor="classification-lc116" className="flex items-center gap-1">
                  Item da LC 116 <FiscalTermHint termId="lc116-item" />
                </Label>
                <Input
                  id="classification-lc116"
                  value={formState.lc116Item}
                  onChange={(event) => updateField("lc116Item", event.target.value)}
                  placeholder="Ex.: 17.06"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="classification-cclasstrib" className="flex items-center gap-1">
                cClassTrib <FiscalTermHint termId="cclasstrib" />
              </Label>
              <Input
                id="classification-cclasstrib"
                inputMode="numeric"
                maxLength={6}
                value={formState.cClassTrib}
                onChange={(event) => updateField("cClassTrib", event.target.value)}
                placeholder="6 dígitos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="classification-cst">CST do IBS/CBS</Label>
              <Input
                id="classification-cst"
                inputMode="numeric"
                maxLength={3}
                value={formState.cst}
                onChange={(event) => updateField("cst", event.target.value)}
                placeholder="3 dígitos"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1">
                Redução de CBS/IBS <FiscalTermHint termId="cclasstrib" />
              </Label>
              <Select
                value={String(formState.reductionBps)}
                onValueChange={(value) => updateField("reductionBps", Number(value) as ReductionBps)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REDUCTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isProduct && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="classification-iss-rate" className="flex items-center gap-1">
                    ISS deste serviço (%) <FiscalTermHint termId="iss" />
                  </Label>
                  <Input
                    id="classification-iss-rate"
                    inputMode="decimal"
                    value={formState.issRatePercent}
                    onChange={(event) => updateField("issRatePercent", event.target.value)}
                    placeholder="Vazio = do perfil"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="classification-iss-city">Município do ISS (IBGE)</Label>
                  <Input
                    id="classification-iss-city"
                    inputMode="numeric"
                    maxLength={7}
                    value={formState.issMunicipioIbge}
                    onChange={(event) => updateField("issMunicipioIbge", event.target.value)}
                    placeholder="7 dígitos"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-info text-white hover:bg-info">
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
