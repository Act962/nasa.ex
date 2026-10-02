"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Save } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  centsToBrlInput,
  parseBrlInputToCents,
} from "@/features/nasa-route/lib/price-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BOTTOM_SHEET_ACTION_CLASS,
  BOTTOM_SHEET_BODY_CLASS,
  BOTTOM_SHEET_DIALOG_CLASS,
  BOTTOM_SHEET_FOOTER_CLASS,
  BOTTOM_SHEET_HANDLE_CLASS,
  BOTTOM_SHEET_HEADER_CLASS,
} from "../../lib/bottom-sheet-dialog";

interface Plan {
  id?: string;
  name: string;
  description?: string | null;
  priceStars: number;
  priceBrlCents?: number;
  isDefault?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  initial?: Plan;
}

export function PlanForm({ open, onClose, courseId, initial }: Props) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceStars, setPriceStars] = useState(
    initial?.priceStars?.toString() ?? "0",
  );
  const [priceBrl, setPriceBrl] = useState<string>(
    centsToBrlInput(initial?.priceBrlCents),
  );
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertPlan.mutationOptions(),
    onSuccess: () => {
      toast.success(isEdit ? "Plano atualizado!" : "Plano criado!");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListPlans.queryKey({ input: { courseId } }),
      });
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    const priceBrlCents = parseBrlInputToCents(priceBrl);
    if (priceBrlCents > 0 && priceBrlCents < 50) {
      toast.error("Valor mínimo aceito pelo gateway é R$ 0,50.");
      return;
    }
    upsert.mutate({
      id: initial?.id,
      courseId,
      name: name.trim(),
      description: description.trim() || null,
      priceStars: Number(priceStars) || 0,
      priceBrlCents,
      isDefault,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(BOTTOM_SHEET_DIALOG_CLASS, "sm:max-w-md")}>
        <div aria-hidden className={BOTTOM_SHEET_HANDLE_CLASS} />
        <DialogHeader className={BOTTOM_SHEET_HEADER_CLASS}>
          <DialogTitle>{isEdit ? "Editar plano" : "Novo plano"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={BOTTOM_SHEET_BODY_CLASS}>
          <div className="space-y-2">
            <Label htmlFor="plan-name">Nome do plano *</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Básico, Premium, VIP…"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-description">Descrição</Label>
            <Textarea
              id="plan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que está incluído neste plano"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-price-brl">Preço (R$)</Label>
            <Input
              id="plan-price-brl"
              type="text"
              inputMode="decimal"
              value={priceBrl}
              onChange={(e) => setPriceBrl(e.target.value)}
              placeholder="Ex: 49,90"
            />
            <p className="text-xs text-muted-foreground">
              Valor cobrado via Stripe. Use 0 para plano gratuito (mínimo
              cobrável: R$ 0,50).
            </p>
          </div>
          <div className="flex items-center justify-between rounded-[18px] border border-border bg-muted/30 p-3">
            <div>
              <Label htmlFor="plan-default" className="cursor-pointer">
                Plano padrão
              </Label>
              <p className="text-xs text-muted-foreground">
                Selecionado automaticamente quando o aluno entra no curso.
              </p>
            </div>
            <Switch
              id="plan-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
          </div>

          <DialogFooter className={BOTTOM_SHEET_FOOTER_CLASS}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={upsert.isPending}
              className="max-sm:hidden"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending} className={cn(BOTTOM_SHEET_ACTION_CLASS, "gap-1.5")}>
              {upsert.isPending ? (
                <OrbitaSpinner className="size-4 " />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
