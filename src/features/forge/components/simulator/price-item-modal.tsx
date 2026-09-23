"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateForgePriceItem,
  useUpdateForgePriceItem,
} from "@/features/forge/hooks/use-forge-price-catalog";

const CATEGORIES = [
  "AI_MODEL",
  "WHATSAPP_CONVERSATION",
  "INFRA_SERVER",
  "HOSTING",
  "STORAGE",
  "DATABASE",
  "LABOR",
  "OTHER",
] as const;

const UNITS = [
  "PER_1K_TOKENS",
  "PER_CONVERSATION",
  "PER_MONTH",
  "PER_HOUR",
  "PER_GB_MONTH",
  "PER_COMPUTE_HOUR",
  "FLAT",
] as const;

export interface PriceItemForForm {
  id: string;
  category: string;
  name: string;
  code: string | null;
  provider: string | null;
  currency: string;
  unit: string;
  unitPrice: string | null;
  inputPer1k: string | null;
  outputPer1k: string | null;
  cachedInputPer1k: string | null;
}

export function PriceItemModal({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PriceItemForForm | null;
}) {
  const createMutation = useCreateForgePriceItem();
  const updateMutation = useUpdateForgePriceItem();

  const [category, setCategory] = useState("OTHER");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [provider, setProvider] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [unit, setUnit] = useState("PER_MONTH");
  const [unitPrice, setUnitPrice] = useState("");
  const [inputPer1k, setInputPer1k] = useState("");
  const [outputPer1k, setOutputPer1k] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory(item?.category ?? "OTHER");
    setName(item?.name ?? "");
    setCode(item?.code ?? "");
    setProvider(item?.provider ?? "");
    setCurrency(item?.currency ?? "BRL");
    setUnit(item?.unit ?? "PER_MONTH");
    setUnitPrice(item?.unitPrice ?? "");
    setInputPer1k(item?.inputPer1k ?? "");
    setOutputPer1k(item?.outputPer1k ?? "");
  }, [open, item]);

  const isAi = category === "AI_MODEL";

  async function handleSubmit() {
    const payload = {
      category: category as never,
      name,
      code: code || null,
      provider: provider || null,
      currency: currency as never,
      unit: unit as never,
      unitPrice: isAi ? null : unitPrice || null,
      inputPer1k: isAi ? inputPer1k || null : null,
      outputPer1k: isAi ? outputPer1k || null : null,
    };
    try {
      if (item) {
        await updateMutation.mutateAsync({ ...payload, id: item.id });
        toast.success("Preço atualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Item criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o item");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar preço" : "Novo item de preço"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unidade">
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome">
            <Input value={name} onChange={(event) => setName(event.target.value)} className="h-9" />
          </Field>
          <Field label="Código (opcional)">
            <Input value={code} onChange={(event) => setCode(event.target.value)} className="h-9" />
          </Field>
          <Field label="Provedor">
            <Input value={provider} onChange={(event) => setProvider(event.target.value)} className="h-9" />
          </Field>
          <Field label="Moeda">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isAi ? (
            <>
              <Field label="Input / 1k">
                <Input value={inputPer1k} onChange={(event) => setInputPer1k(event.target.value)} className="h-9" />
              </Field>
              <Field label="Output / 1k">
                <Input value={outputPer1k} onChange={(event) => setOutputPer1k(event.target.value)} className="h-9" />
              </Field>
            </>
          ) : (
            <Field label="Preço unitário">
              <Input value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="h-9" />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-[#7C3AED] hover:bg-[#6D28D9]"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
