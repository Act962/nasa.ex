"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getContrastColor } from "@/utils/get-contrast-color";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";

export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";

  const firstInitial = parts[0][0] || "";
  const secondInitial = parts.length > 1 ? parts[1][0] : "";

  return (firstInitial + secondInitial).toUpperCase();
}

export type LeadWithTrackingAndStatus = {
  name: string;
  id: string;
  email: string | null;
  createdAt: Date;
  phone: string | null;
  status: {
    name: string;
    id: string;
    color: string | null;
  };
  tracking: {
    name: string;
    id: string;
  };
};

export const columns: ColumnDef<LeadWithTrackingAndStatus>[] = [
  {
    id: "Nome",
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <div className="flex items-center gap-2 group">
          Nome
          <ArrowUpDown
            role="button"
            className="size-4 group-hover:opacity-100 opacity-0 transition-opacity"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        </div>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-sm">
              {row.original.email}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "Contato",
    accessorKey: "phone",
    header: "Telefone",
  },
  {
    id: "Status",
    accessorKey: "status.name",
    header: "Status",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full`}
            style={{
              backgroundColor: row.original.status.color ?? "#1447e6",
              color: getContrastColor(row.original.status.color || "#000000"),
            }}
          >
            {row.original.status.name}
          </span>
        </div>
      );
    },
  },
  {
    id: "Tracking",
    accessorKey: "tracking.name",
    header: "Tracking",
    cell: ({ row }) => {
      return row.original.tracking.name;
    },
  },
  {
    id: "Data de criação",
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <div className="flex items-center gap-2 group">
          Data de criação
          <ArrowUpDown
            role="button"
            className="size-4 group-hover:opacity-100 opacity-0 transition-opacity"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        </div>
      );
    },
    cell: ({ row }) => {
      return dayjs(row.original.createdAt).format("DD/MM/YYYY");
    },
  },
  {
    id: "action",
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem className="cursor-pointer" role="button" asChild>
              <Link href={`/contatos/${row.original.id}`}>Visualizar</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
