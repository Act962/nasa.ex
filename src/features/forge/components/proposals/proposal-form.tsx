"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import {
  useCreateForgeProposal,
  useUpdateForgeProposal,
  useForgeProducts,
} from "../../hooks/use-forge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Package, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  maskNumber,
  sanitizeNumericString,
  parseNumericString,
  formatNumericForInput,
} from "@/utils/mask-number";
import {
  maskMoney,
  formatDecimalToMoney,
} from "@/utils/mask-money";
import { TemplatePicker } from "./template-picker";
import { type TemplateId } from "../public/proposal-templates";

const GATEWAYS = [
  { value: "STRIPE", label: "Stripe" },
  { value: "ASAAS", label: "Asaas" },
  { value: "PAGBANK", label: "PagBank" },
  { value: "PAGSEGURO", label: "PagSeguro" },
  { value: "MERCADOPAGO", label: "Mercado Pago" },
  { value: "BANCO_DO_BRASIL", label: "Banco do Brasil" },
  { value: "CAIXA_ECONOMICA", label: "Caixa Econômica" },
  { value: "PIX", label: "PIX" },
];

const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  clientId: z.string().optional(),
  responsibleId: z.string().min(1, "Responsável obrigatório"),
  validUntil: z.string().optional(),
  description: z.string().optional(),
  discount: z.string().optional(),
  discountType: z.enum(["PERCENTUAL", "FIXO"]).optional(),
  paymentLink: z.string().optional(),
  paymentGateway: z.string().optional(),
  template: z.enum(["modern", "clean", "corporate", "bold", "premium"]).default("modern"),
  products: z.array(z.object({
    productId: z.string().min(1, "Selecione um produto"),
    quantity: z.string().default("1"),
    unitValue: z.string().default("0"),
    discount: z.string().optional(),
    description: z.string().optional(),
    order: z.number().default(0),
  })).default([]),
});

type FormData = z.infer<typeof schema>;

interface ProposalFormProps {
  open: boolean;
  onClose: () => void;
  proposalId?: string;
}

export function ProposalForm({ open, onClose, proposalId }: ProposalFormProps) {
  const create = useCreateForgeProposal();
  const update = useUpdateForgeProposal();
  const [generatingLink, setGeneratingLink] = useState(false);
  const { data: productsData } = useForgeProducts();
  // Load existing proposal if editing
  const { data: existingData } = useQuery({
    ...orpc.forge.proposals.get.queryOptions({ input: { id: proposalId ?? "" } }),
    enabled: !!proposalId,
  });

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? "";

  const { data: orgMembers } = useQuery(
    orpc.orgs.listMembers.queryOptions({ input: { query: {} } }),
  );

  const form = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      title: "",
      responsibleId: currentUserId,
      products: [],
      discountType: "PERCENTUAL",
      template: "modern",
    },
  });

  const { fields, append, remove, update: updateField } = useFieldArray({
    control: form.control,
    name: "products",
  });

  // Auto-fill responsible with current user for new proposals
  useEffect(() => {
    if (!proposalId && currentUserId && !form.getValues("responsibleId")) {
      form.setValue("responsibleId", currentUserId);
    }
  }, [currentUserId, proposalId]);

  useEffect(() => {
    if (existingData?.proposal) {
      const p = existingData.proposal;
      const VALID_TEMPLATES = ["modern", "clean", "corporate", "bold", "premium"] as const;
      const savedTemplate = (p.headerConfig as { template?: string } | null)?.template;
      const template = VALID_TEMPLATES.includes(savedTemplate as typeof VALID_TEMPLATES[number])
        ? (savedTemplate as typeof VALID_TEMPLATES[number])
        : "modern";

      const discountType = (p.discountType as "PERCENTUAL" | "FIXO") ?? "PERCENTUAL";

      form.reset({
        title: p.title,
        clientId: p.clientId ?? undefined,
        responsibleId: p.responsibleId,
        validUntil: p.validUntil ? new Date(p.validUntil).toISOString().split("T")[0] : undefined,
        description: p.description ?? undefined,
        discount: p.discount
          ? discountType === "FIXO"
            ? formatDecimalToMoney(p.discount)
            : formatNumericForInput(p.discount)
          : undefined,
        discountType,
        paymentLink: p.paymentLink ?? undefined,
        paymentGateway: p.paymentGateway ?? undefined,
        template,
        products: p.products.map((pp: { productId: string; quantity: string; unitValue: string; discount: string | null; description: string | null; order: number }) => ({
          productId: pp.productId,
          quantity: formatNumericForInput(pp.quantity),
          unitValue: formatDecimalToMoney(pp.unitValue),
          discount: pp.discount ? formatDecimalToMoney(pp.discount) : undefined,
          description: pp.description ?? undefined,
          order: pp.order,
        })),
      });
    }
  }, [existingData]);

  // Calculate totals
  const watchedProducts = form.watch("products");
  const watchedDiscount = form.watch("discount");
  const watchedDiscountType = form.watch("discountType");

  const subtotal = watchedProducts.reduce((sum, pp) => {
    return (
      sum +
      parseNumericString(pp.quantity) * parseNumericString(pp.unitValue) -
      parseNumericString(pp.discount)
    );
  }, 0);

  const discountAmount = watchedDiscount
    ? watchedDiscountType === "PERCENTUAL"
      ? subtotal * (parseNumericString(watchedDiscount) / 100)
      : parseNumericString(watchedDiscount)
    : 0;

  const total = subtotal - discountAmount;

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onSubmit = async (data: FormData) => {
    try {
      // Persist template inside headerConfig JSON field (no schema migration needed)
      const headerConfig = { template: data.template ?? "modern" };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { template: _tpl, ...rest } = data;
      // Garante que valores numéricos (quantidade, valor unit., descontos)
      // cheguem ao backend sem caracteres especiais — os campos Decimal do
      // Prisma quebram em runtime se receberem algo além de dígitos/ponto.
      const sanitized = {
        ...rest,
        discount: rest.discount ? sanitizeNumericString(rest.discount) : rest.discount,
        products: rest.products.map((product) => ({
          ...product,
          quantity: sanitizeNumericString(product.quantity),
          unitValue: sanitizeNumericString(product.unitValue),
          discount: product.discount ? sanitizeNumericString(product.discount) : product.discount,
        })),
      };
      if (proposalId) {
        await update.mutateAsync({ id: proposalId, ...sanitized, headerConfig });
        toast.success("Proposta atualizada");
      } else {
        await create.mutateAsync({ ...sanitized, headerConfig } as Parameters<typeof create.mutateAsync>[0]);
        toast.success("Proposta criada");
      }
      onClose();
    } catch {
      toast.error("Erro ao salvar proposta");
    }
  };

  const isPending = create.isPending || update.isPending;
  const products = productsData?.products ?? [];

  const handleGenerateLink = async () => {
    const gateway = form.getValues("paymentGateway");
    if (!gateway) {
      toast.error("Selecione um gateway de pagamento antes de gerar o link.");
      return;
    }
    if (!proposalId) {
      toast.error("Salve a proposta primeiro para gerar o link.");
      return;
    }
    setGeneratingLink(true);
    try {
      const res = await fetch("/api/forge/generate-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          gateway,
          amount: total,
          description: form.getValues("title"),
          customerEmail: existingData?.proposal?.client?.email ?? "",
          customerName: existingData?.proposal?.client?.name ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar link");
      form.setValue("paymentLink", data.paymentLink);
      toast.success("Link de pagamento gerado com sucesso!");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Erro ao gerar link de pagamento");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleAddProduct = () => {
    append({ productId: "", quantity: "1", unitValue: "", order: fields.length });
  };

  const handleSelectProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      form.setValue(`products.${index}.productId`, productId);
      form.setValue(
        `products.${index}.unitValue`,
        formatDecimalToMoney(product.value),
      );
    }
  };

  // Desconto geral alterna entre valor fixo (R$) e percentual (%). Ao trocar o
  // tipo, reinterpreta o número já digitado no formato correto.
  const handleDiscountTypeChange = (nextType: "PERCENTUAL" | "FIXO") => {
    const currentDiscount = form.getValues("discount");
    form.setValue("discountType", nextType);
    if (!currentDiscount) return;
    const numericDiscount = parseNumericString(currentDiscount);
    form.setValue(
      "discount",
      nextType === "FIXO"
        ? formatDecimalToMoney(numericDiscount)
        : formatNumericForInput(String(numericDiscount)),
      { shouldDirty: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proposalId ? "Editar Proposta" : "Nova Proposta"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 min-w-0">
          {/* Identificação */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identificação</h3>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input {...form.register("title")} placeholder="Ex: Proposta de Social Media — Janeiro 2026" />
              {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
            </div>
          </div>

          <Separator />

          {/* Responsável + Validade */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Responsável e Validade</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Responsável *</Label>
                <Select
                  value={form.watch("responsibleId")}
                  onValueChange={(v) => form.setValue("responsibleId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(orgMembers?.members ?? []).map((m: { id: string; name: string }) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Validade</Label>
                <Input type="date" {...form.register("validUntil")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Descrição */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Descrição</h3>
            <Textarea
              {...form.register("description")}
              placeholder="Descreva os detalhes da proposta..."
              rows={3}
              className="min-h-[80px] max-h-48 overflow-y-auto resize-none"
            />
          </div>

          <Separator />

          {/* Template da proposta */}
          <TemplatePicker
            value={(form.watch("template") as TemplateId) ?? "modern"}
            onChange={(id) => form.setValue("template", id)}
          />

          <Separator />

          {/* Produtos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Produtos / Serviços</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct} className="gap-1.5">
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="border border-dashed rounded-lg py-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Package className="size-6" />
                <span>Nenhum produto adicionado</span>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 items-start">
                    <div className="min-w-0">
                      <Select
                        value={form.watch(`products.${index}.productId`)}
                        onValueChange={(v) => handleSelectProduct(index, v)}
                      >
                        <SelectTrigger className="text-xs h-8 w-full min-w-0 *:data-[slot=select-value]:min-w-0">
                          <SelectValue placeholder="Produto..." />
                        </SelectTrigger>
                        <SelectContent className="max-w-[min(20rem,var(--radix-select-content-available-width))]">
                          {products.map((p) => (
                            <SelectItem
                              key={p.id}
                              value={p.id}
                              className="[&>span:last-child]:block [&>span:last-child]:min-w-0 [&>span:last-child]:truncate"
                            >
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.watch(`products.${index}.productId`) && (
                        <Input
                          {...form.register(`products.${index}.description`)}
                          placeholder="Descrição opcional"
                          className="mt-1 text-xs h-7"
                        />
                      )}
                    </div>
                    <Input
                      {...form.register(`products.${index}.quantity`)}
                      value={form.watch(`products.${index}.quantity`) ?? ""}
                      onChange={(e) =>
                        form.setValue(`products.${index}.quantity`, maskNumber(e.target.value), {
                          shouldDirty: true,
                        })
                      }
                      placeholder="Qtd"
                      type="text"
                      inputMode="decimal"
                      className="text-xs h-8"
                    />
                    <Input
                      {...form.register(`products.${index}.unitValue`)}
                      value={form.watch(`products.${index}.unitValue`) ?? ""}
                      onChange={(e) =>
                        form.setValue(`products.${index}.unitValue`, maskMoney(e.target.value), {
                          shouldDirty: true,
                        })
                      }
                      placeholder="R$ 0,00"
                      type="text"
                      inputMode="numeric"
                      className="text-xs h-8"
                    />
                    <Input
                      {...form.register(`products.${index}.discount`)}
                      value={form.watch(`products.${index}.discount`) ?? ""}
                      onChange={(e) =>
                        form.setValue(`products.${index}.discount`, maskMoney(e.target.value), {
                          shouldDirty: true,
                        })
                      }
                      placeholder="R$ 0,00"
                      type="text"
                      inputMode="numeric"
                      className="text-xs h-8"
                    />
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => remove(index)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Column labels */}
                <div className="grid grid-cols-[1fr_80px_100px_80px_32px] gap-2 text-[10px] text-muted-foreground px-0.5">
                  <span>Produto</span><span>Qtd</span><span>Valor unit.</span><span>Desc. item</span><span />
                </div>

                {/* Totals */}
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-2 text-muted-foreground">
                    <span className="shrink-0">Subtotal</span>
                    <span className="min-w-0 truncate text-right">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground flex-1">Desconto geral</span>
                    <div className="flex gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => handleDiscountTypeChange("PERCENTUAL")}
                        className={cn("px-2 py-0.5 rounded text-[11px] border", form.watch("discountType") === "PERCENTUAL" ? "bg-[#7C3AED] text-white border-[#7C3AED]" : "border-border")}
                      >%</button>
                      <button
                        type="button"
                        onClick={() => handleDiscountTypeChange("FIXO")}
                        className={cn("px-2 py-0.5 rounded text-[11px] border", form.watch("discountType") === "FIXO" ? "bg-[#7C3AED] text-white border-[#7C3AED]" : "border-border")}
                      >R$</button>
                      <Input
                        {...form.register("discount")}
                        value={form.watch("discount") ?? ""}
                        onChange={(e) =>
                          form.setValue(
                            "discount",
                            form.getValues("discountType") === "FIXO"
                              ? maskMoney(e.target.value)
                              : maskNumber(e.target.value),
                            { shouldDirty: true },
                          )
                        }
                        type="text"
                        inputMode="numeric"
                        className="w-24 h-7 text-xs"
                        placeholder={form.watch("discountType") === "FIXO" ? "R$ 0,00" : "0%"}
                      />
                    </div>
                    <span className="max-w-[7rem] shrink-0 truncate text-right">{fmt(discountAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-bold text-[#7C3AED] text-base border-t pt-1">
                    <span className="shrink-0">Total</span>
                    <span className="min-w-0 truncate text-right">{fmt(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Pagamento */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Gateway de Pagamento</Label>
                <Select
                  value={form.watch("paymentGateway") ?? ""}
                  onValueChange={(v) => form.setValue("paymentGateway", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAYS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link de Pagamento</Label>
                <div className="flex gap-2">
                  <Input {...form.register("paymentLink")} placeholder="https://pay.stripe.com/..." className="flex-1" />
                  {proposalId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="Gerar link via gateway"
                      onClick={handleGenerateLink}
                      disabled={generatingLink || !form.watch("paymentGateway")}
                    >
                      {generatingLink
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Link2 className="size-4" />}
                    </Button>
                  )}
                </div>
                {proposalId && (
                  <p className="text-[11px] text-muted-foreground">
                    Clique em <Link2 className="inline size-3" /> para gerar automaticamente via gateway configurado.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
            >
              {isPending ? "Salvando..." : "Salvar Proposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
