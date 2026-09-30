"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApplySuggestedPrice } from "@/features/accounting/hooks/use-accounting-pricing";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import type { ApplyPriceEventDetail } from "../calculator/apply-price-event";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

interface ApplyPricePanelProps {
  suggestion: ApplyPriceEventDetail;
  products: Array<{ id: string; name: string; sku: string; priceCents: number }>;
  onDismiss: () => void;
}

/** Painel "Aplicar preço sugerido": leva o preço da calculadora de markup para um produto do Forge. */
export function ApplyPricePanel({ suggestion, products, onDismiss }: ApplyPricePanelProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const applySuggestedPrice = useApplySuggestedPrice();
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  function handleApply() {
    if (!selectedProduct) return;
    applySuggestedPrice.mutate(
      { productId: selectedProduct.id, priceCents: suggestion.priceCents },
      {
        onSuccess: () => {
          toast.success(`Preço de "${selectedProduct.name}" atualizado para ${formatCentsBrl(suggestion.priceCents)}.`);
          onDismiss();
        },
        onError: (error) => toast.error(error.message || "Não foi possível aplicar o preço."),
      },
    );
  }

  return (
    <Card className="border-violet-500 bg-violet-500/5">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-semibold">
              <Tag className="size-4 text-violet-600" />
              Aplicar preço sugerido
            </p>
            <p className="text-sm text-muted-foreground">
              A calculadora sugeriu <strong>{formatCentsBrl(suggestion.priceCents)}</strong>, já com{" "}
              {formatBps(suggestion.taxRateBps)} de imposto embutido <FiscalTermHint termId="markup-divisor" />.
              Escolha o produto que vai receber esse preço.
            </p>
          </div>
          <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={onDismiss} aria-label="Fechar">
            <X className="size-4" />
          </Button>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre um produto no Forge para aplicar o preço.</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Produto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} — hoje {formatCentsBrl(product.priceCents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleApply}
              disabled={!selectedProduct || applySuggestedPrice.isPending}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {applySuggestedPrice.isPending ? "Aplicando..." : "Confirmar novo preço"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
