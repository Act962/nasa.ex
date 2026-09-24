"use client";

import { DataTable } from "./data-table";
import { columns } from "./columns";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useContactsFilters } from "../hooks/use-contacts-filters";

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

  return (
    <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
      <DataTable columns={columns} data={data?.leads ?? []} />
    </div>
  );
}
