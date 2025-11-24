"use client";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

export function TableLeads() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusId, setStatusId] = useState<string | undefined>();
  const [trackingId, setTrackingId] = useState<string | undefined>();

  const { data, isLoading, isFetching } = useSuspenseQuery(
    orpc.leads.search.queryOptions({
      input: {
        page: page,
        limit: pageSize,
        trackingId: trackingId,
        statusId: statusId,
      },
    })
  );

  return (
    <DataTable
      columns={columns}
      data={data?.leads ?? []}
      pageCount={data?.totalPages ?? 0}
      currentPage={page}
      pageSize={pageSize}
      totalItems={data?.total ?? 0}
      onPageChange={setPage}
      onPageSizeChange={(newSize) => {
        setPageSize(newSize);
        setPage(1); // Reset para primeira página
      }}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1); // Reset para primeira página ao buscar
      }}
      searchValue={search}
      isLoading={isLoading || isFetching}
      // Opcional: adicionar filtros
      onStatusChange={(value) => {
        setStatusId(value);
        setPage(1);
      }}
      onTrackingChange={(value) => {
        setTrackingId(value);
        setPage(1);
      }}
    />
  );
}
