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
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";

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
            <AvatarFallback>JS</AvatarFallback>
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
    accessorKey: "phone",
    header: "Telefone",
  },
  {
    accessorKey: "status.name",
    header: "Status",
  },
  {
    accessorKey: "tracking.name",
    header: "Tracking",
  },
  {
    accessorKey: "createdAt",
    header: "Data de criação",
    cell: ({ row }) => {
      return dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm");
    },
  },
  {
    id: "action",
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
            <DropdownMenuItem onClick={() => {}}>
              Copy payment ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View customer</DropdownMenuItem>
            <DropdownMenuItem>View payment details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// Column Cel Exemple
// function TableCell({ className, ...props }: React.ComponentProps<"td">) {
//   return (
//     <td
//       data-slot="table-cell"
//       className={cn(
//         "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
//         className
//       )}
//       {...props}
//     />
//   )
// }
