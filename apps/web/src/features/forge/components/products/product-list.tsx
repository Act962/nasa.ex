"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Package, Pencil, Trash2, Plus } from "lucide-react";
import { ProductImage } from "./product-image";
import { Product } from "./product-modal";

interface ProductListProps {
  isLoading: boolean;
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function ProductList({
  isLoading,
  products,
  onEdit,
  onDelete,
  onAdd,
}: ProductListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-center">
        <Package className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
        <Button variant="outline" onClick={onAdd}>
          <Plus className="size-4 mr-1.5" /> Adicionar produto
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <TooltipProvider delayDuration={300}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[200px]">Produto</TableHead>
              <TableHead className="w-[110px] hidden sm:table-cell">SKU</TableHead>
              <TableHead className="w-[80px] hidden md:table-cell">Unidade</TableHead>
              <TableHead className="text-right w-[120px]">Valor</TableHead>
              <TableHead className="text-right w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-0">
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5">
                      <ProductImage imageKey={p.imageUrl} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      {p.description && (
                        <>
                          {/* Short screens: show 1 line */}
                          <p className="text-xs text-muted-foreground line-clamp-1 sm:hidden">
                            {p.description}
                          </p>
                          {/* Medium screens: show 2 lines with tooltip for full text */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground line-clamp-2 hidden sm:block cursor-default">
                                {p.description}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-xs text-xs whitespace-pre-wrap"
                            >
                              {p.description}
                            </TooltipContent>
                          </Tooltip>
                        </>
                      )}
                      {/* SKU inline on small screens */}
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 sm:hidden">
                        {p.sku}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs hidden sm:table-cell">
                  {p.sku}
                </TableCell>
                <TableCell className="text-xs hidden md:table-cell">
                  {p.unit}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold whitespace-nowrap">
                  {Number(p.value).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(p.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TooltipProvider>
    </div>
  );
}
