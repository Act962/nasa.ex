"use client";

import type { OnChangeFn, PaginationState } from "@tanstack/react-table";
import { parseAsInteger, parseAsString, useQueryState, useQueryStates } from "nuqs";
import { useCallback, useState } from "react";

const DEFAULT_PAGE_SIZE = 20;

interface UseActionTableStateProps {
  /**
   * `false` mantém paginação e busca em estado local. Necessário quando a
   * tabela é embutida fora da rota de workspace (ex: sheet de ações do lead),
   * senão ela escreveria `pageIndex`/`pageSize`/`q` na URL da página
   * hospedeira — e os params sobreviveriam ao fechar o sheet.
   */
  persistInUrl: boolean;
}

/**
 * Paginação + busca da tabela de ações. Os dois modos rodam sempre (regra dos
 * hooks); `persistInUrl` só decide qual par é devolvido. Ler nuqs nunca
 * escreve, então manter o modo URL montado é inofensivo.
 */
export function useActionTableState({ persistInUrl }: UseActionTableStateProps) {
  const [urlPagination, setUrlPagination] = useQueryStates({
    pageIndex: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  });
  const [urlSearch, setUrlSearch] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );

  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [localSearch, setLocalSearch] = useState("");

  const setSearch = useCallback(
    (value: string) => {
      if (persistInUrl) {
        setUrlSearch(value || null);
        return;
      }
      setLocalSearch(value);
    },
    [persistInUrl, setUrlSearch],
  );

  const pagination = persistInUrl ? urlPagination : localPagination;

  // Normaliza os dois setters na assinatura que o TanStack Table espera — o
  // do nuqs aceita objeto/updater e o do useState aceita SetStateAction, então
  // devolver a união direto não tipa.
  const setPagination = useCallback<OnChangeFn<PaginationState>>(
    (updaterOrValue) => {
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(pagination)
          : updaterOrValue;

      if (persistInUrl) {
        setUrlPagination(next);
        return;
      }
      setLocalPagination(next);
    },
    [pagination, persistInUrl, setUrlPagination],
  );

  return {
    pagination,
    setPagination,
    search: persistInUrl ? urlSearch : localSearch,
    setSearch,
  };
}
