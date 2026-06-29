"use client";

import { ArrowUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionFilters } from "../../hooks/use-action-filters";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "order", label: "Nenhum" },
  { value: "createdAt", label: "Data de criação" },
  { value: "dueDate", label: "Prazo" },
  { value: "priority", label: "Prioridade" },
  { value: "title", label: "Título" },
] as const;

interface Props {
  variant?: "popover" | "list";
}

export function SortFilter({ variant = "popover" }: Props) {
  const { filters, setFilters } = useActionFilters();

  const isSorted = filters.sortBy !== "order" || filters.sortOrder !== "asc";

  const content = (
    <div className={cn("space-y-3", variant === "popover" && "w-52")}>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Ordenar por
        </p>
        <Select
          value={filters.sortBy}
          onValueChange={(v) =>
            setFilters({ ...filters, sortBy: v as typeof filters.sortBy })
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Ordem
        </p>
        <div className="flex gap-2">
          {(["asc", "desc"] as const).map((o) => (
            <Button
              key={o}
              variant={filters.sortOrder === o ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => setFilters({ ...filters, sortOrder: o })}
            >
              {o === "asc" ? "Crescente" : "Decrescente"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  if (variant === "list") {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <ArrowUpDownIcon className="size-4 text-muted-foreground" />
          Ordenação
        </h4>
        {content}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={isSorted ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 text-xs"
        >
          <ArrowUpDownIcon className="size-3" />
          Ordenar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-3" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
}
