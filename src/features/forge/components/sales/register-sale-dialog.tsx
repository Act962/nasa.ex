"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, Plus, Receipt, Trash2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { phoneMaskFull, normalizeWhatsappPhoneBr } from "@/utils/format-phone";
import { formatDecimalToMoney, maskMoney, unmaskMoney } from "@/utils/mask-money";
import { useForgeProducts } from "@/features/forge/hooks/use-forge";
import { useRegisterSale, useSaleClientLookup } from "@/features/forge/hooks/use-forge-sales";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { PAYMENT_METHOD_LABELS, type SalePaymentMethod } from "@/features/forge/lib/sale-payment";

interface SaleItemDraft {
  productId: string;
  quantity: number;
  unitValue: string;
  discountPerUnit: string;
}

interface RegisteredSale {
  publicToken: string;
  number: number;
  isDuplicate: boolean;
}

const emptyItem: SaleItemDraft = { productId: "", quantity: 1, unitValue: "R$ 0,00", discountPerUnit: "R$ 0,00" };
const centsToReais = (masked: string) => unmaskMoney(masked) / 100;

export function RegisterSaleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [document, setDocument] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [items, setItems] = useState<SaleItemDraft[]>([emptyItem]);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("PIX");
  const [installments, setInstallments] = useState(1);
  const [registered, setRegistered] = useState<RegisteredSale | null>(null);

  const lookup = useSaleClientLookup(phone);
  const { data: productsData } = useForgeProducts();
  const { trackings } = useQueryTrackings();
  const registerSale = useRegisterSale();

  const products = productsData?.products ?? [];
  const client = lookup.data?.client ?? null;
  const isNewClient = lookup.isSuccess && lookup.data.isPhoneValid && !client;
  const total = items.reduce((sum, item) => sum + item.quantity * (centsToReais(item.unitValue) - centsToReais(item.discountPerUnit)), 0);
  const receiptUrl = registered ? `${window.location.origin}/proposta/${registered.publicToken}/recibo` : "";

  const updateItem = (index: number, patch: Partial<SaleItemDraft>) =>
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  const chooseProduct = (index: number, productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    updateItem(index, { productId, unitValue: formatDecimalToMoney(product?.value ?? 0) });
  };

  const canSubmit =
    lookup.isSuccess &&
    lookup.data.isPhoneValid &&
    (client || (newClientName.trim() && trackingId)) &&
    items.every((item) => item.productId && item.quantity > 0) &&
    total > 0;

  const submit = () => {
    registerSale.mutate(
      {
        phone,
        name: newClientName || undefined,
        trackingId: trackingId || undefined,
        document: document || undefined,
        address: { street, neighborhood, city },
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitValue: centsToReais(item.unitValue),
          discountPerUnit: centsToReais(item.discountPerUnit),
        })),
        paymentMethod,
        installments: paymentMethod === "CREDITO" ? installments : undefined,
      },
      {
        onSuccess: (sale) => {
          setRegistered(sale);
          emitTourResult({ kind: GUIDE_RESULT_KINDS.saleRegistered });
          if (sale.isDuplicate) toast.info("Essa venda já tinha sido registrada agora há pouco.");
        },
        onError: (error) => toast.error(error.message || "Não foi possível registrar a venda."),
      },
    );
  };

  const whatsappHref = () => {
    const clientPhone = normalizeWhatsappPhoneBr(phone) ?? "";
    const message = `Olá! Segue o seu recibo: ${receiptUrl}`;
    return `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar venda</DialogTitle>
        </DialogHeader>

        {registered ? (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <p className="text-lg font-semibold">Venda nº {registered.number} registrada</p>
            <p className="text-sm text-muted-foreground">Total {formatDecimalToMoney(total)}. Entregue o recibo ao cliente.</p>
            <div className="flex flex-col gap-2">
              <Button asChild className="h-11 gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5a]">
                <a href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> Enviar recibo no WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 gap-2">
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  <Receipt className="size-4" /> Ver recibo
                </a>
              </Button>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>WhatsApp do cliente</Label>
              <Input
                inputMode="tel"
                placeholder="(86) 99999-9999"
                value={phoneMaskFull(phone)}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
              />
              {lookup.isFetching ? <p className="text-xs text-muted-foreground">Procurando o cliente…</p> : null}
              {lookup.isSuccess && !lookup.data.isPhoneValid ? (
                <p className="text-xs text-destructive">Número inválido: confira o DDD.</p>
              ) : null}
              {client ? (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm">
                  <UserCheck className="size-4 text-success" />
                  <span>
                    <strong>{client.name}</strong> · {client.hasConversation ? "conversou no WhatsApp" : "já cadastrado"} ({client.trackingName})
                  </span>
                </div>
              ) : null}
              {isNewClient ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium"><UserPlus className="size-4" /> Cliente novo</p>
                  <Input placeholder="Nome do cliente" value={newClientName} onChange={(event) => setNewClientName(event.target.value)} />
                  <Select value={trackingId} onValueChange={setTrackingId}>
                    <SelectTrigger><SelectValue placeholder="Funil onde o cliente entra" /></SelectTrigger>
                    <SelectContent>
                      {trackings.map((tracking) => (
                        <SelectItem key={tracking.id} value={tracking.id}>{tracking.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">CPF/CNPJ e endereço (opcional, vai no recibo)</summary>
              <div className="mt-3 grid gap-2">
                <Input placeholder="CPF ou CNPJ" value={document} onChange={(event) => setDocument(event.target.value)} />
                <Input placeholder="Rua, quadra, número" value={street} onChange={(event) => setStreet(event.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} />
                  <Input placeholder="Cidade" value={city} onChange={(event) => setCity(event.target.value)} />
                </div>
              </div>
            </details>

            <div className="space-y-3">
              <Label>Produtos</Label>
              {items.map((item, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex gap-2">
                    <Select value={item.productId} onValueChange={(productId) => chooseProduct(index, productId)}>
                      <SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {items.length > 1 ? (
                      <Button variant="ghost" size="icon" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Qtd</Label>
                      <Input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Preço un.</Label>
                      <Input inputMode="numeric" value={item.unitValue} onChange={(event) => updateItem(index, { unitValue: maskMoney(event.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Desconto un.</Label>
                      <Input inputMode="numeric" value={item.discountPerUnit} onChange={(event) => updateItem(index, { discountPerUnit: maskMoney(event.target.value) })} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setItems((current) => [...current, emptyItem])}>
                <Plus className="size-4" /> Outro produto
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Pagamento</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as SalePaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => (
                      <SelectItem key={method} value={method}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === "CREDITO" ? (
                <div>
                  <Label>Parcelas</Label>
                  <Input type="number" min={1} max={24} value={installments} onChange={(event) => setInstallments(Math.min(24, Math.max(1, Number(event.target.value) || 1)))} />
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold">{formatDecimalToMoney(total)}</span>
            </div>

            <Button
              className="h-11 w-full gap-2"
              disabled={!canSubmit || registerSale.isPending}
              onClick={submit}
              data-guide={GUIDE_ANCHORS.forgeRegisterSaleSubmit.id}
            >
              {registerSale.isPending ? <OrbitaSpinner className="size-4" /> : <Receipt className="size-4" />}
              Gerar recibo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
