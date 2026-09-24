"use client";

import { DataTable } from "./data-table";
import { columns } from "./columns";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useContactsFilters } from "../hooks/use-contacts-filters";
import { SelectionBar } from "../selection-bar";
import { useMemo, useState } from "react";
import type { LeadWithTrackingAndStatus } from "./columns";

export function TableLeads() {
  const filters = useContactsFilters();

  // `useQuery`, não `useSuspenseQuery`: com filtro a consulta muda e o
  // suspense remontaria a tabela inteira a cada clique num card.
  const { data, isFetching } = useQuery(
    orpc.leads.list.queryOptions({
      input: {
        trackingId: filters.trackingId,
        tagIds: filters.tagIds.length > 0 ? filters.tagIds : undefined,
        dateField: filters.dateField,
        from: filters.from?.toISOString(),
        to: filters.to?.toISOString(),
        segment: filters.segment,
      },
    }),
  );

  const [selected, setSelected] = useState<LeadWithTrackingAndStatus[]>([]);
  const [clearToken, setClearToken] = useState(0);

  // `data?.leads ?? []` criava um array novo a cada render, e a tabela limpa
  // a seleção quando os dados mudam — os dois juntos viravam laço infinito.
  const rows = useMemo(() => data?.leads ?? [], [data?.leads]);

  return (
    <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
      <DataTable
        columns={columns}
        data={rows}
        onSelectionChange={setSelected}
        clearSelectionToken={clearToken}
      />
      <SelectionBar
        count={selected.length}
        leadIds={selected.map((lead) => lead.id)}
        onClear={() => setClearToken((token) => token + 1)}
      />
    </div>
  );
}
