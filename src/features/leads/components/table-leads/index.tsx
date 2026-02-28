"use client";

import { DataTable } from "./data-table";
import { columns } from "./columns";
import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";

export function TableLeads() {
  const { data } = useSuspenseQuery(orpc.leads.list.queryOptions());

  return <DataTable columns={columns} data={data.leads} />;
}
