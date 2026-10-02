"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ProductImage } from "./product-image";
import type { Product } from "./product-modal";

interface ProductCardListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

function toCurrency(value: string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductCardList({ products, onEdit, onDelete }: ProductCardListProps) {
  return (
    <ul className="space-y-2">
      {products.map((product) => (
        <li key={product.id}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onEdit(product)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(product);
              }
            }}
            className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3 transition-colors active:bg-muted"
          >
            <ProductImage
              imageKey={product.imageUrl}
              className="size-14 shrink-0 rounded-[14px]"
              iconClassName="size-5"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{product.name}</p>
              <p className="mt-0.5 text-base font-bold tabular-nums">{toCurrency(product.value)}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {product.unit}
                {product.sku && <span className="font-mono"> · {product.sku}</span>}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Ações do produto"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors active:bg-muted/70"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem onSelect={() => onEdit(product)}>
                  <Pencil /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(product.id)}>
                  <Trash2 /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
      ))}
    </ul>
  );
}
