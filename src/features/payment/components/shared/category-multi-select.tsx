"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tags, ChevronDown, Search, X } from "lucide-react";
import { usePaymentCategories } from "../../hooks/use-payment";
import { CATEGORY_TYPE_LABELS } from "../../lib/format";
import { cn } from "@/lib/utils";

// Multi-seleção de categorias. Lista vazia = todas — o rótulo diz "Todas as
// categorias" em vez de "0 selecionadas", que soaria como filtro que zera o
// resultado.

interface CategoryMultiSelectProps {
  selectedIds: string[];
  onChange: (categoryIds: string[]) => void;
  triggerClassName?: string;
}

const TYPE_ORDER = ["REVENUE", "COST", "EXPENSE"] as const;

export function CategoryMultiSelect({
  selectedIds,
  onChange,
  triggerClassName,
}: CategoryMultiSelectProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = usePaymentCategories();

  const categories = useMemo(() => data?.categories ?? [], [data]);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = term
      ? categories.filter((category) => category.name.toLowerCase().includes(term))
      : categories;

    return TYPE_ORDER.map((type) => ({
      type,
      items: matching.filter((category) => category.type === type),
    })).filter((group) => group.items.length > 0);
  }, [categories, search]);

  const selectedNames = categories
    .filter((category) => selectedIds.includes(category.id))
    .map((category) => category.name);

  function toggle(categoryId: string) {
    onChange(
      selectedIds.includes(categoryId)
        ? selectedIds.filter((id) => id !== categoryId)
        : [...selectedIds, categoryId],
    );
  }

  const label =
    selectedNames.length === 0
      ? "Todas as categorias"
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames.length} categorias`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start gap-1.5 font-normal",
            selectedIds.length === 0 && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <Tags className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          {selectedIds.length > 1 && (
            <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
              {selectedIds.length}
            </Badge>
          )}
          <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar categoria..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto scroll-cols-tracking p-1">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-7 animate-pulse rounded bg-muted/40" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {search ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.type} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_TYPE_LABELS[group.type] ?? group.type}
                </p>
                {group.items.map((category) => {
                  const isSelected = selectedIds.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(category.id)}
                      />
                      {category.color && (
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <span className="truncate">
                        {category.icon ? `${category.icon} ` : ""}
                        {category.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => onChange([])}
            >
              <X className="size-3.5" />
              Limpar seleção ({selectedIds.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
