"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Uploader } from "@/components/file-uploader/uploader";
import {
  maskMoney,
  moneyToDecimalString,
  formatDecimalToMoney,
} from "@/utils/mask-money";
import {
  useCreateForgeProduct,
  useUpdateForgeProduct,
} from "../../hooks/use-forge";

export const UNITS = ["un", "hr", "dia", "mês", "km", "kg", "L", "outro"];

export const productSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sku: z.string().min(1, "SKU obrigatório"),
  unit: z.string().default("un"),
  description: z.string().optional(),
  value: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((value) => Number(moneyToDecimalString(value)) > 0, "Valor inválido"),
  imageUrl: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  description: string | null;
  value: string;
  imageUrl: string | null;
}

function ProductImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <Uploader
      value={value || undefined}
      fileTypeAccepted="image"
      onConfirm={onChange}
    />
  );
}

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

export function ProductModal({ open, onClose, product }: ProductModalProps) {
  const create = useCreateForgeProduct();
  const update = useUpdateForgeProduct();
  const [imageKey, setImageKey] = useState<string>(product?.imageUrl ?? "");

  const form = useForm<ProductFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      unit: product?.unit ?? "un",
      description: product?.description ?? "",
      value: product ? formatDecimalToMoney(product.value) : "",
      imageUrl: product?.imageUrl ?? "",
    },
  });

  // `useForm` só inicializa `defaultValues` na montagem. Como o modal é
  // mantido montado entre aberturas, precisamos sincronizar manualmente
  // quando `product` muda (ou quando troca de "novo" pra "editar X"
  // e vice-versa).
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      unit: product?.unit ?? "un",
      description: product?.description ?? "",
      value: product ? formatDecimalToMoney(product.value) : "",
      imageUrl: product?.imageUrl ?? "",
    });
    setImageKey(product?.imageUrl ?? "");
  }, [open, product, form]);

  const onSubmit = async (data: ProductFormData) => {
    try {
      const payload = {
        ...data,
        value: moneyToDecimalString(data.value),
        imageUrl: imageKey || undefined,
      };
      if (product) {
        await update.mutateAsync({ id: product.id, ...payload });
        toast.success("Produto atualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Produto criado");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar produto");
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                {...form.register("name")}
                placeholder="Ex: Gestão de Social Media"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <Input {...form.register("sku")} placeholder="Ex: SMS-001" />
              {form.formState.errors.sku && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sku.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unidade *</Label>
              <Select
                value={form.watch("unit")}
                onValueChange={(v) => form.setValue("unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor *</Label>
              <Input
                {...form.register("value")}
                value={form.watch("value") ?? ""}
                onChange={(e) =>
                  form.setValue("value", maskMoney(e.target.value), {
                    shouldDirty: true,
                  })
                }
                placeholder="R$ 0,00"
                type="text"
                inputMode="numeric"
              />
              {form.formState.errors.value && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.value.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Imagem do Produto</Label>
            <ProductImageUploader
              value={imageKey}
              onChange={(key) => setImageKey(key)}
            />
            <p className="text-[11px] text-muted-foreground">
              Arraste ou clique para enviar. Máximo 5MB.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              className="min-h-[100px] max-h-48 overflow-y-scroll"
              {...form.register("description")}
              placeholder="Descreva o produto ou serviço..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
            >
              {isPending ? "Salvando..." : "Salvar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
