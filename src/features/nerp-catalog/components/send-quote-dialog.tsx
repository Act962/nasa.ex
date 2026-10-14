"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HandCoinsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { computeQuotedTotals, InvalidQuoteError } from "../lib/order-quote";
import { formatBrl } from "../utils/format-order";
import type { CatalogOrderItem } from "../schemas/order-payload";
import { useSendCatalogOrderQuote } from "../hooks/use-catalog-order-quote";

type QuoteDialogItem = Pick<CatalogOrderItem, "name" | "quantity" | "unitPrice" | "total">;

interface SendQuoteDialogProps {
  orderId: string;
  saleNumber: number;
  items: QuoteDialogItem[];
  shipping: number;
  discount: number;
}

function parseMoney(text: string): number {
  const trimmed = text.trim();
  // "1.234,56" (padrão BR) ou "10.5": só trata ponto como milhar quando há vírgula.
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (normalized === "") return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

function toMoneyText(value: number): string {
  return value > 0 ? value.toFixed(2).replace(".", ",") : "";
}

// Spec 0103, RF-3/RF-9: o atendente digita os preços; o total é recalculado igual ao servidor.
export function SendQuoteDialog({ orderId, saleNumber, items, shipping, discount }: SendQuoteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unitPriceTexts, setUnitPriceTexts] = useState(() => items.map((item) => toMoneyText(item.unitPrice)));
  const [shippingText, setShippingText] = useState(() => toMoneyText(shipping));
  const [discountText, setDiscountText] = useState(() => toMoneyText(discount));
  const [note, setNote] = useState("");
  const sendQuote = useSendCatalogOrderQuote();

  const quotePreview = useMemo(() => {
    const quote = {
      unitPrices: unitPriceTexts.map(parseMoney),
      shipping: parseMoney(shippingText),
      discount: parseMoney(discountText),
    };
    try {
      const fullItems = items.map((item) => ({ ...item, productId: "", sku: null, imageUrl: null }));
      return { quote, totals: computeQuotedTotals(fullItems, quote), errorMessage: null };
    } catch (error) {
      return { quote, totals: null, errorMessage: error instanceof InvalidQuoteError ? error.message : "Valores inválidos." };
    }
  }, [items, unitPriceTexts, shippingText, discountText]);

  function handleSubmit() {
    if (!quotePreview.totals) return;
    sendQuote.mutate(
      { orderId, ...quotePreview.quote, note: note.trim() || undefined },
      {
        onSuccess: (result) => {
          if (result.isDelivered) toast.success("Valor enviado ao cliente. O Astro segue com a aprovação e o pagamento.");
          else toast.warning("Valor salvo, mas a mensagem não chegou ao cliente. Ele vê o valor na página do pedido.");
          setIsOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" data-guide={GUIDE_ANCHORS.catalogOrderSendQuote.id}>
          <HandCoinsIcon className="size-3.5" />
          Enviar valor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Valor do pedido #{saleNumber}</DialogTitle>
          <DialogDescription>
            O cliente recebe o valor no WhatsApp e aprova. Só depois o Astro gera o PIX ou o link de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {item.quantity} × preço unitário
                  {quotePreview.totals && ` = ${formatBrl(quotePreview.totals.items[index].total)}`}
                </p>
              </div>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                className="w-28 text-right tabular-nums"
                aria-label={`Preço unitário de ${item.name}`}
                value={unitPriceTexts[index]}
                onChange={(event) =>
                  setUnitPriceTexts((current) => current.map((text, textIndex) => (textIndex === index ? event.target.value : text)))
                }
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="quote-shipping" className="text-xs">Frete</Label>
              <Input id="quote-shipping" inputMode="decimal" placeholder="0,00" className="text-right tabular-nums" value={shippingText} onChange={(event) => setShippingText(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="quote-discount" className="text-xs">Desconto</Label>
              <Input id="quote-discount" inputMode="decimal" placeholder="0,00" className="text-right tabular-nums" value={discountText} onChange={(event) => setDiscountText(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="quote-note" className="text-xs">Recado ao cliente (opcional)</Label>
            <Textarea id="quote-note" rows={2} maxLength={500} placeholder="Ex.: entrega amanhã pela manhã" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold tabular-nums">
            {quotePreview.totals ? formatBrl(quotePreview.totals.total) : "—"}
          </span>
        </div>
        {quotePreview.errorMessage && <p className="text-xs text-destructive">{quotePreview.errorMessage}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!quotePreview.totals || sendQuote.isPending}>
            {sendQuote.isPending ? "Enviando…" : "Enviar ao cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
