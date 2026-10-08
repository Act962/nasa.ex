import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ListPlus, Minus, Plus, Trash2 } from "lucide-react";
import {
  FormBlockInstance,
  FormBlockType,
  FormCategoryType,
  HandleBlurFunc,
  ObjectBlockType,
} from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { usePrefillFieldValue } from "@/features/form/context/form-prefill-context";
import { useForgeProducts } from "@/features/forge/hooks/use-forge";
import {
  ITEM_LIST_KIND,
  parseItemListMeta,
  type ItemListConfigItem,
  type PricedItem,
} from "@/features/form-records/lib/item-list-value";
import { findMeasureUnit, formatCents, parseDecimalInput } from "@/features/form-records/lib/measure-units";

// Bloco "Lista de itens" (spec 0075, RF-2). No preenchimento só se informa a
// quantidade; preço e total são gravados pelo servidor e aparecem na leitura.

const blockCategory: FormCategoryType = "Field";
const blockType: FormBlockType = "ItemList";
const MAX_ITEMS = 120;

type AttributesType = {
  label: string;
  helperText: string;
  required: boolean;
  items: ItemListConfigItem[];
};

type Instance = FormBlockInstance & { attributes: AttributesType };

export const ItemListBlock: ObjectBlockType = {
  blockType,
  blockCategory,
  createInstance: (id) => ({
    id,
    blockType,
    attributes: { label: "Itens utilizados", helperText: "", required: false, items: [] } satisfies AttributesType,
  }),
  blockBtnElement: { icon: ListPlus, label: "Lista de itens" },
  canvasComponent: CanvasView,
  formComponent: FormView,
  propertiesComponent: PropertiesView,
};

/** Formulário salvo sem a lista (outro caminho de criação) não pode quebrar a tela. */
function readItems(blockInstance: FormBlockInstance): ItemListConfigItem[] {
  const items = (blockInstance as Instance).attributes?.items;
  return Array.isArray(items) ? items : [];
}

function unitSymbol(unit: string): string {
  return findMeasureUnit(unit)?.symbol ?? unit;
}

function BlockLabel({ label, required, hasError }: { label: string; required: boolean; hasError?: boolean }) {
  if (!label?.trim()) return null;
  return (
    <Label className={`mb-2 whitespace-normal break-words text-base font-normal! leading-snug ${hasError ? "text-destructive" : ""}`}>
      {label}
      {required && <span className="text-destructive"> *</span>}
    </Label>
  );
}

function CanvasView({ blockInstance }: { blockInstance: FormBlockInstance }) {
  const { label, required, helperText } = (blockInstance as Instance).attributes;
  const items = readItems(blockInstance);
  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} />
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Nenhum item ainda. Adicione itens do catálogo nas propriedades deste campo.
        </p>
      ) : (
        <ul className="pointer-events-none divide-y rounded-md border">
          {items.slice(0, 6).map((item) => (
            <li key={item.itemId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 text-muted-foreground">0 {unitSymbol(item.unit)}</span>
            </li>
          ))}
          {items.length > 6 && <li className="px-3 py-2 text-xs text-muted-foreground">e mais {items.length - 6} itens</li>}
        </ul>
      )}
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function FormView({
  blockInstance,
  handleBlur,
  isError: isSubmitError,
}: {
  blockInstance: FormBlockInstance;
  handleBlur?: HandleBlurFunc;
  isError?: boolean;
}) {
  const block = blockInstance as Instance;
  const { label, required, helperText } = block.attributes;
  const items = readItems(blockInstance);

  const savedMeta = parseItemListMeta(usePrefillFieldValue(block.id)?.meta);
  const savedItemsById = useMemo(
    () => new Map<string, PricedItem>((savedMeta?.items ?? []).map((item) => [item.itemId, item])),
    [savedMeta],
  );
  const [quantityTextById, setQuantityTextById] = useState<Record<string, string>>(() =>
    Object.fromEntries((savedMeta?.items ?? []).map((item) => [item.itemId, item.quantity.toLocaleString("pt-BR")])),
  );

  const readQuantity = (itemId: string, source = quantityTextById) => {
    const parsed = parseDecimalInput(source[itemId] ?? "");
    return parsed !== null && parsed > 0 ? parsed : 0;
  };

  const publish = (nextTextById: Record<string, string>) => {
    const filled = items
      .map((item) => ({ itemId: item.itemId, quantity: readQuantity(item.itemId, nextTextById) }))
      .filter((item) => item.quantity > 0);
    handleBlur?.(block.id, {
      value: filled.length > 0 ? `${filled.length} ${filled.length === 1 ? "item" : "itens"}` : "",
      meta: { kind: ITEM_LIST_KIND, version: 1, items: filled },
    });
  };

  // Resposta salva entra no formulário mesmo sem o usuário tocar em nada.
  useEffect(() => {
    if (savedMeta) publish(quantityTextById);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setQuantityText = (itemId: string, text: string, shouldPublish: boolean) => {
    const nextTextById = { ...quantityTextById, [itemId]: text };
    setQuantityTextById(nextTextById);
    if (shouldPublish) publish(nextTextById);
  };

  const stepQuantity = (itemId: string, delta: number) => {
    const next = Math.max(0, readQuantity(itemId) + delta);
    setQuantityText(itemId, next === 0 ? "" : next.toLocaleString("pt-BR"), true);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <BlockLabel label={label} required={required} hasError={isSubmitError} />
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">Este campo ainda não tem itens.</p>
      ) : (
        <ul className={`divide-y rounded-md border ${isSubmitError ? "border-destructive" : ""}`}>
          {items.map((item) => {
            const savedItem = savedItemsById.get(item.itemId);
            const hasSavedPrice = savedItem && savedItem.unitPriceCents !== null && readQuantity(item.itemId) === savedItem.quantity;
            return (
              <li key={item.itemId} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="break-words text-sm leading-snug">{item.name}</p>
                  {hasSavedPrice && (
                    <p className="text-xs text-muted-foreground">
                      {formatCents(savedItem.unitPriceCents ?? 0)} / {unitSymbol(item.unit)} ·{" "}
                      {item.billingMode === "INFO" ? "informativo, não entra no total" : formatCents(savedItem.lineTotalCents)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    data-record-stepper
                    aria-label={`Diminuir ${item.name}`}
                    onClick={() => stepQuantity(item.itemId, -1)}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    inputMode="decimal"
                    aria-label={`Quantidade de ${item.name}`}
                    value={quantityTextById[item.itemId] ?? ""}
                    placeholder="0"
                    onChange={(event) => setQuantityText(item.itemId, event.target.value, false)}
                    onBlur={(event) => setQuantityText(item.itemId, event.target.value, true)}
                    className="h-8 w-16 px-1 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    data-record-stepper
                    aria-label={`Aumentar ${item.name}`}
                    onClick={() => stepQuantity(item.itemId, 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                  <span className="w-8 text-xs text-muted-foreground">{unitSymbol(item.unit)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {savedMeta && savedMeta.usageTotalCents > 0 && (
        <p className="text-right text-sm font-medium">Total dos itens: {formatCents(savedMeta.usageTotalCents)}</p>
      )}
      {helperText && <p className="whitespace-normal break-words text-[0.8rem] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function PropertiesView({
  positionIndex,
  parentId,
  blockInstance,
}: {
  positionIndex?: number;
  parentId?: string;
  blockInstance: FormBlockInstance;
}) {
  const block = blockInstance as Instance;
  const { updateChildBlock } = useBuilderStore();
  const attributes = { ...block.attributes, items: readItems(blockInstance) };
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const { data, isLoading } = useForgeProducts(search.trim() || undefined);

  const commit = (partial: Partial<AttributesType>) => {
    if (!parentId) return;
    updateChildBlock(parentId, block.id, { ...block, attributes: { ...attributes, ...partial } });
  };

  const addedProductIds = new Set(attributes.items.map((item) => item.productId).filter(Boolean));
  const availableProducts = (data?.products ?? []).filter((product) => !addedProductIds.has(product.id)).slice(0, 8);
  const isFull = attributes.items.length >= MAX_ITEMS;

  const addItem = (item: Omit<ItemListConfigItem, "itemId" | "billingMode">) => {
    if (isFull) return;
    commit({ items: [...attributes.items, { ...item, itemId: crypto.randomUUID(), billingMode: "USAGE" }] });
  };
  const updateItem = (itemId: string, partial: Partial<ItemListConfigItem>) =>
    commit({ items: attributes.items.map((item) => (item.itemId === itemId ? { ...item, ...partial } : item)) });
  const removeItem = (itemId: string) => commit({ items: attributes.items.filter((item) => item.itemId !== itemId) });

  return (
    <div className="w-full pb-4">
      <div className="mb-[10px] flex h-auto w-full flex-row items-center justify-between gap-1 rounded-md bg-foreground/10 p-1 px-2">
        <span className="text-sm font-medium tracking-wider text-muted-foreground">Lista de itens {positionIndex}</span>
        <ChevronDown className="h-4 w-4" />
      </div>
      <div className="w-full space-y-3 px-4">
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Título</Label>
          <Input value={attributes.label} onChange={(event) => commit({ label: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[13px] font-normal">Nota</Label>
          <Input value={attributes.helperText} onChange={(event) => commit({ helperText: event.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-normal">Obrigatório</Label>
          <Switch checked={attributes.required} onCheckedChange={(required) => commit({ required })} />
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] font-normal">Itens ({attributes.items.length})</Label>
          {attributes.items.length === 0 && <p className="text-[11px] text-muted-foreground">Busque no catálogo abaixo e toque para adicionar.</p>}
          <ul className="space-y-1">
            {attributes.items.map((item) => (
              <li key={item.itemId} className="rounded-md border border-foreground/10 p-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-[13px]">
                    {item.name} <span className="text-muted-foreground">({unitSymbol(item.unit)})</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${item.name}`} onClick={() => removeItem(item.itemId)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {item.billingMode === "USAGE" ? "Cobrado pelo uso" : "Só informativo (não entra no total)"}
                  </span>
                  <Switch
                    aria-label={`Cobrar ${item.name} pelo uso`}
                    checked={item.billingMode === "USAGE"}
                    onCheckedChange={(isUsage) => updateItem(item.itemId, { billingMode: isUsage ? "USAGE" : "INFO" })}
                  />
                </div>
                {!item.productId && <p className="mt-1 text-[11px] text-muted-foreground">Fora do catálogo: sem preço.</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-md border border-foreground/10 bg-foreground/[0.03] p-3">
          <Label className="text-[13px] font-medium">Adicionar do catálogo</Label>
          <Input value={search} placeholder="Buscar por nome ou código" onChange={(event) => setSearch(event.target.value)} />
          {isLoading && <p className="text-[11px] text-muted-foreground">Buscando...</p>}
          {!isLoading && availableProducts.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Nada encontrado. Cadastre o item no catálogo do Forge para ele ter preço.</p>
          )}
          <ul className="space-y-1">
            {availableProducts.map((product) => (
              <li key={product.id}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFull}
                  className="h-auto w-full justify-between gap-2 whitespace-normal py-1.5 text-left"
                  onClick={() => addItem({ productId: product.id, name: product.name, unit: product.unit })}
                >
                  <span className="min-w-0 break-words">{product.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatCents(Math.round(Number(product.value) * 100))}</span>
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input value={customName} maxLength={80} placeholder="Item fora do catálogo" onChange={(event) => setCustomName(event.target.value)} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isFull || customName.trim().length < 2}
              onClick={() => {
                addItem({ productId: null, name: customName.trim(), unit: "un" });
                setCustomName("");
              }}
            >
              Adicionar
            </Button>
          </div>
          {isFull && <p className="text-[11px] text-muted-foreground">Limite de {MAX_ITEMS} itens por lista.</p>}
        </div>
      </div>
    </div>
  );
}
