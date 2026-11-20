"use client";

import { useState } from "react";
import { PackageCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDecimalToMoney, maskMoney } from "@/utils/mask-money";
import { useForgeProducts } from "@/features/forge/hooks/use-forge";
import { normalizeProductName } from "@/features/forge/utils/normalize-product-name";
import { EMPTY_RECEIPT_ITEM, type ReceiptItemDraft } from "./receipt-draft";

const MAX_SUGGESTIONS = 5;

interface CatalogProduct {
  id: string;
  name: string;
  value: string | number;
}

function ItemNameField({
  item,
  catalog,
  onChange,
}: {
  item: ReceiptItemDraft;
  catalog: CatalogProduct[];
  onChange: (patch: Partial<ReceiptItemDraft>) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const query = normalizeProductName(item.name);
  const suggestions = query
    ? catalog.filter((product) => normalizeProductName(product.name).includes(query)).slice(0, MAX_SUGGESTIONS)
    : catalog.slice(0, MAX_SUGGESTIONS);
  const shouldShowSuggestions = isFocused && !item.productId && suggestions.length > 0;

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        placeholder="Produto ou serviço"
        value={item.name}
        maxLength={120}
        onFocus={() => setIsFocused(true)}
        // O clique na sugestão acontece antes do blur com este atraso.
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        onChange={(event) => onChange({ name: event.target.value, productId: "" })}
      />
      {item.productId ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
          <PackageCheck className="size-3" /> Do catálogo
        </p>
      ) : item.name.trim() ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Item novo: entra no catálogo do Forge ao emitir.</p>
      ) : null}
      {shouldShowSuggestions ? (
        <ul className="absolute inset-x-0 top-10 z-20 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {suggestions.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange({ productId: product.id, name: product.name, unitValue: formatDecimalToMoney(product.value) });
                  setIsFocused(false);
                }}
              >
                <span className="min-w-0 truncate">{product.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDecimalToMoney(product.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Itens do recibo: busca no catálogo do Forge ou nome e preço digitados na hora (spec 0151, RF-4). */
export function ReceiptItemsEditor({ items, onChange }: { items: ReceiptItemDraft[]; onChange: (items: ReceiptItemDraft[]) => void }) {
  const { data } = useForgeProducts();
  const catalog: CatalogProduct[] = data?.products ?? [];
  const updateItem = (index: number, patch: Partial<ReceiptItemDraft>) =>
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <ItemNameField item={item} catalog={catalog} onChange={(patch) => updateItem(index, patch)} />
            {items.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover item"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Qtd</Label>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">Preço un.</Label>
              <Input inputMode="numeric" value={item.unitValue} onChange={(event) => updateItem(index, { unitValue: maskMoney(event.target.value) })} />
            </div>
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">Desconto un.</Label>
              <Input
                inputMode="numeric"
                value={item.discountPerUnit}
                onChange={(event) => updateItem(index, { discountPerUnit: maskMoney(event.target.value) })}
              />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...items, EMPTY_RECEIPT_ITEM])}>
        <Plus className="size-4" /> Outro item
      </Button>
    </div>
  );
}
