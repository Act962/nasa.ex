"use client";
import { DataTable } from "./data-table";
import { columns, LeadWithTrackingAndStatus } from "./columns";
import { getQueryClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";

const leads: LeadWithTrackingAndStatus[] = [
  {
    name: "Lead 1",
    id: "1",
    email: "lead1@example.com",
    createdAt: new Date(),
    phone: "123456789",
    status: {
      name: "Status 1",
      id: "1",
      color: "red",
    },
    tracking: {
      name: "Tracking 1",
      id: "1",
    },
  },
  {
    name: "Lead 2",
    id: "2",
    email: "lead2@example.com",
    createdAt: new Date(),
    phone: "123456789",
    status: {
      name: "Status 2",
      id: "2",
      color: "green",
    },
    tracking: {
      name: "Tracking 2",
      id: "2",
    },
  },
  {
    name: "Lead 3",
    id: "3",
    email: "lead3@example.com",
    createdAt: new Date(),
    phone: "123456789",
    status: {
      name: "Status 3",
      id: "3",
      color: "blue",
    },
    tracking: {
      name: "Tracking 3",
      id: "3",
    },
  },
];

export function TableLeads() {
  const { data } = useSuspenseQuery(
    orpc.leads.search.queryOptions({
      input: {},
    })
  );

  return <DataTable columns={columns} data={data.leads} />;
}
