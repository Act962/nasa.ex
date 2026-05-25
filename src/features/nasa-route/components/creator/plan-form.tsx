"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
    initial?.priceBrlCents != null
      ? (initial.priceBrlCents / 100).toFixed(2)
      : "",
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
    const priceBrlCents = Math.round((Number(priceBrl) || 0) * 100);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plano" : "Novo plano"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              type="number"
              min={0}
              step="0.01"
              value={priceBrl}
              onChange={(e) => setPriceBrl(e.target.value)}
              placeholder="Ex: 49,90"
            />
            <p className="text-xs text-muted-foreground">
              Valor cobrado via Stripe. Use 0 para plano gratuito (mínimo
              cobrável: R$ 0,50).
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={upsert.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending ? (
                <Loader2 className="size-4 animate-spin" />
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
