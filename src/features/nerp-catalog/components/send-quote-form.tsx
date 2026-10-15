"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeQuotedTotals, InvalidQuoteError } from "../lib/order-quote";
import { formatBrl } from "../utils/format-order";
import type { CatalogOrderItem } from "../schemas/order-payload";
import { useSendCatalogOrderQuote } from "../hooks/use-catalog-order-quote";

export type QuoteFormItem = Pick<CatalogOrderItem, "name" | "quantity" | "unitPrice" | "total"> & {
  referenceUnitPrice: number | null;
  referenceBoxPrice: number | null;
  packQty: number | null;
};

interface SendQuoteFormProps {
  orderId: string;
  items: QuoteFormItem[];
  shipping: number;
  discount: number;
  onSent?: () => void;
  onCancel?: () => void;
  /** Venda guiada: o valor passa pela equipe antes de ir ao cliente (spec 0104). */
  isTeamApproval?: boolean;
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

// Pedido de orçamento chega com itens a R$ 0: parte do preço de tabela do NERP, que o consultor ajusta.
function toInitialUnitPrice(item: QuoteFormItem): number {
  return item.unitPrice > 0 ? item.unitPrice : (item.referenceUnitPrice ?? 0);
}

function hasPositive(value: number | null): value is number {
  return value !== null && value > 0;
}

type PriceMode = "unit" | "box";

function boxSizeOf(item: QuoteFormItem): number | null {
  return item.packQty !== null && item.packQty > 1 ? item.packQty : null;
}

function toInitialBoxPrice(item: QuoteFormItem, boxSize: number): number {
  if (item.unitPrice > 0) return item.unitPrice * boxSize;
  return item.referenceBoxPrice ?? (item.referenceUnitPrice ?? 0) * boxSize;
}

function toUnitPrice(typedValue: number, mode: PriceMode, boxSize: number | null): number {
  return mode === "box" && boxSize ? typedValue / boxSize : typedValue;
}

// Spec 0103, RF-3/RF-11: o consultor parte do preço do NERP e envia o valor negociado.
export function SendQuoteForm({ orderId, items, shipping, discount, isTeamApproval = false, onSent, onCancel }: SendQuoteFormProps) {
  const [priceModes, setPriceModes] = useState<PriceMode[]>(() => items.map(() => "unit"));
  const [priceTexts, setPriceTexts] = useState(() => items.map((item) => toMoneyText(toInitialUnitPrice(item))));
  const [shippingText, setShippingText] = useState(() => toMoneyText(shipping));
  const [discountText, setDiscountText] = useState(() => toMoneyText(discount));
  const [note, setNote] = useState("");
  const sendQuote = useSendCatalogOrderQuote();

  const quotePreview = useMemo(() => {
    const quote = {
      unitPrices: priceTexts.map((text, index) =>
        toUnitPrice(parseMoney(text), priceModes[index], boxSizeOf(items[index])),
      ),
      shipping: parseMoney(shippingText),
      discount: parseMoney(discountText),
    };
    try {
      const fullItems = items.map((item) => ({ ...item, productId: "", sku: null, imageUrl: null }));
      return { quote, totals: computeQuotedTotals(fullItems, quote), errorMessage: null };
    } catch (error) {
      return { quote, totals: null, errorMessage: error instanceof InvalidQuoteError ? error.message : "Valores inválidos." };
    }
  }, [items, priceTexts, priceModes, shippingText, discountText]);

  function changePriceMode(index: number, nextMode: PriceMode) {
    const item = items[index];
    const boxSize = boxSizeOf(item);
    if (!boxSize || priceModes[index] === nextMode) return;
    const typedValue = parseMoney(priceTexts[index]);
    const convertedValue = !Number.isFinite(typedValue) || typedValue <= 0
      ? nextMode === "box" ? toInitialBoxPrice(item, boxSize) : toInitialUnitPrice(item)
      : nextMode === "box" ? typedValue * boxSize : typedValue / boxSize;
    setPriceModes((current) => current.map((mode, modeIndex) => (modeIndex === index ? nextMode : mode)));
    setPriceTexts((current) =>
      current.map((text, textIndex) => (textIndex === index ? toMoneyText(Math.round(convertedValue * 100) / 100) : text)),
    );
  }

  function handleSubmit() {
    if (!quotePreview.totals) return;
    sendQuote.mutate(
      { orderId, ...quotePreview.quote, note: note.trim() || undefined },
      {
        onSuccess: (result) => {
          if (result.isAwaitingInternalApproval) toast.success("Valor enviado para a aprovação da equipe. O cliente recebe depois de aprovado.");
          else if (result.isDelivered) toast.success("Valor enviado ao cliente. O Astro segue com a aprovação e o pagamento.");
          else toast.warning("Valor salvo, mas a mensagem não chegou ao cliente. Ele vê o valor na página do pedido.");
          onSent?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {item.quantity} un. × preço unitário
                {quotePreview.totals && ` = ${formatBrl(quotePreview.totals.items[index].total)}`}
              </p>
              {(hasPositive(item.referenceUnitPrice) || hasPositive(item.referenceBoxPrice)) && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  NERP:
                  {hasPositive(item.referenceUnitPrice) && ` un. ${formatBrl(item.referenceUnitPrice)}`}
                  {hasPositive(item.referenceUnitPrice) && hasPositive(item.referenceBoxPrice) && " ·"}
                  {hasPositive(item.referenceBoxPrice) &&
                    ` caixa${hasPositive(item.packQty) ? ` (${item.packQty} un.)` : ""} ${formatBrl(item.referenceBoxPrice)}`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {boxSizeOf(item) && (
                <div className="flex rounded-md border border-border/60 p-0.5 text-[11px]" role="group" aria-label={`Cobrar ${item.name} por`}>
                  {(["unit", "box"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={priceModes[index] === mode}
                      onClick={() => changePriceMode(index, mode)}
                      className={`rounded px-2 py-0.5 transition-colors ${priceModes[index] === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {mode === "unit" ? "por unidade" : `por caixa (${boxSizeOf(item)})`}
                    </button>
                  ))}
                </div>
              )}
              <Input
                inputMode="decimal"
                placeholder="0,00"
                className="w-28 text-right tabular-nums"
                aria-label={`${priceModes[index] === "box" ? "Preço da caixa" : "Preço unitário"} de ${item.name}`}
                value={priceTexts[index]}
                onChange={(event) =>
                  setPriceTexts((current) => current.map((text, textIndex) => (textIndex === index ? event.target.value : text)))
                }
              />
              {priceModes[index] === "box" && quotePreview.totals && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  = {formatBrl(quotePreview.totals.items[index].unitPrice)}/un.
                </p>
              )}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`quote-shipping-${orderId}`} className="text-xs">Frete</Label>
            <Input id={`quote-shipping-${orderId}`} inputMode="decimal" placeholder="0,00" className="text-right tabular-nums" value={shippingText} onChange={(event) => setShippingText(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`quote-discount-${orderId}`} className="text-xs">Desconto</Label>
            <Input id={`quote-discount-${orderId}`} inputMode="decimal" placeholder="0,00" className="text-right tabular-nums" value={discountText} onChange={(event) => setDiscountText(event.target.value)} />
          </div>
        </div>

        {/* Na aprovação da equipe a mensagem ao cliente é a do fluxo: o recado não chegaria. */}
        {!isTeamApproval && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`quote-note-${orderId}`} className="text-xs">Recado ao cliente (opcional)</Label>
            <Textarea id={`quote-note-${orderId}`} rows={2} maxLength={500} placeholder="Ex.: entrega amanhã pela manhã" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-bold tabular-nums">
          {quotePreview.totals ? formatBrl(quotePreview.totals.total) : "—"}
        </span>
      </div>
      {quotePreview.errorMessage && <p className="text-xs text-destructive">{quotePreview.errorMessage}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={handleSubmit} disabled={!quotePreview.totals || sendQuote.isPending}>
          {sendQuote.isPending ? "Enviando…" : isTeamApproval ? "Enviar para aprovação" : "Enviar ao cliente"}
        </Button>
      </div>
    </div>
  );
}
