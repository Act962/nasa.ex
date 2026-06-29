"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { getContrastColor } from "@/utils/get-contrast-color";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArchiveRestoreIcon, ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

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
  profile: string | null;
  /** Arquivamento (orthogonal ao status/tracking). Mostra badge "Arquivado"
   *  ao lado do nome quando true. Pode vir undefined pra clients antigos
   *  ainda sem migrate aplicada. */
  isArchived?: boolean | null;
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
    enableHiding: false,
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
      const url = useConstructUrl(row.original.profile || "");
      return (
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src={url} />
            <AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <p className="font-medium">{row.original.name || "Sem nome"}</p>
              {/* Badge "Arquivado" — só renderiza quando lead.isArchived
                  é true. Lead arquivado some do /tracking-chat padrão e
                  aparece só no filtro "Arquivados" lá. Aqui em /contatos
                  continua listado mas com essa marca visual. */}
              {row.original.isArchived && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-1.5 py-0.5">
                  Arquivado
                </span>
              )}
            </div>
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
    cell: ({ row }) => <ContactActionsMenu lead={row.original} />,
  },
];

/**
 * Menu de ações do row em /contatos. Inclui "Desarquivar" quando o lead
 * está com `isArchived: true` (chamada `leads.setArchived({ leadId,
 * isArchived: false })`). Pra arquivar o lead, o usuário deve fazer
 * via `/tracking-chat` (botão "Arquivar contato" no dropdown do chat
 * header) — semântica de "remover da caixa de entrada", não "deletar".
 */
function ContactActionsMenu({ lead }: { lead: LeadWithTrackingAndStatus }) {
  const qc = useQueryClient();
  const unarchive = useMutation(
    orpc.leads.setArchived.mutationOptions({
      onSuccess: () => {
        toast.success("Lead desarquivado.");
        // Invalida lista de /contatos pra remover o badge "Arquivado"
        qc.invalidateQueries({ queryKey: ["leads.list"] });
        // Também invalida lista de conversations pra ele voltar pra
        // caixa de entrada do /tracking-chat
        qc.invalidateQueries({ queryKey: ["conversations.list"] });
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Falha ao desarquivar lead"),
    }),
  );

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
          <Link href={`/contatos/${lead.id}`}>Visualizar</Link>
        </DropdownMenuItem>
        {lead.isArchived && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-emerald-700 focus:text-emerald-800"
              onClick={() =>
                unarchive.mutate({ leadId: lead.id, isArchived: false })
              }
              disabled={unarchive.isPending}
            >
              <ArchiveRestoreIcon className="size-4" /> Desarquivar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
