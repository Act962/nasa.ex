"use client";

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

/**
 * Select genérico de recurso (formulário, agenda, produto, etc) usado
 * nos dialogs das 7 actions "Adicionar Lead no App".
 *
 * Caller passa:
 *  - `queryOptions`: resultado de `orpc.<entidade>.<list>.queryOptions(...)`
 *  - `getItems(data)`: extrai array do shape do return (cada procedure
 *    devolve diferente — `{ forms }`, `{ agendas }`, `{ pages }`, etc)
 *  - `getId(item)` / `getLabel(item)`: como pegar id + label do item
 *  - `value` / `onValueChange`: state controlado
 *  - `placeholder`: texto do trigger quando vazio
 *
 * Loading mostra spinner; vazio mostra "Nenhum recurso encontrado".
 */

interface ResourceSelectProps<TItem> {
  queryOptions: Parameters<typeof useQuery>[0];
  getItems: (data: unknown) => TItem[];
  getId: (item: TItem) => string;
  getLabel: (item: TItem) => string;
  value: string;
  onValueChange: (id: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function ResourceSelect<TItem>({
  queryOptions,
  getItems,
  getId,
  getLabel,
  value,
  onValueChange,
  placeholder = "Selecione um recurso",
  emptyMessage = "Nenhum recurso encontrado.",
}: ResourceSelectProps<TItem>) {
  const { data, isLoading, isError } = useQuery(queryOptions) as UseQueryResult<unknown>;

  const items = useMemo(() => {
    try {
      return data ? getItems(data) : [];
    } catch {
      return [];
    }
  }, [data, getItems]);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="w-full">
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Carregando…
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {isError && (
          <div className="px-2 py-1.5 text-xs text-red-500">
            Erro ao carregar — tente novamente.
          </div>
        )}
        {!isError && !isLoading && items.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        )}
        {items.map((it) => {
          const id = getId(it);
          return (
            <SelectItem key={id} value={id}>
              {getLabel(it)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
