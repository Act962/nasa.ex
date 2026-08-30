"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CheckCircle2,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAYABLE_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"];

type EntryLike = {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: string;
  description: string;
  amount: number;
  paidAmount: number;
  dunningRuleId?: string | null;
};

/**
 * Ações de um lançamento. Usada tanto na linha da tabela (desktop) quanto no
 * card da lista (mobile) — as duas superfícies compartilham o mesmo menu.
 */
export function EntryActionsMenu({
  entry,
  onPay,
  onEdit,
  onAssignDunning,
  onDunningHistory,
  onCancel,
  onDelete,
  className,
}: {
  entry: EntryLike;
  onPay: () => void;
  onEdit: () => void;
  onAssignDunning: () => void;
  onDunningHistory: () => void;
  onCancel: () => void;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8", className)}
          aria-label={`Ações de ${entry.description}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {PAYABLE_STATUSES.includes(entry.status) && (
          <DropdownMenuItem onClick={onPay} className="gap-2">
            <CheckCircle2 className="size-4 text-green-500" />
            Registrar pagamento
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Pencil className="size-4 text-blue-500" />
          Editar
        </DropdownMenuItem>
        {entry.type === "RECEIVABLE" && (
          <>
            <DropdownMenuItem onClick={onAssignDunning} className="gap-2">
              <Bell className="size-4 text-amber-500" />
              Atribuir régua de cobrança
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDunningHistory} className="gap-2">
              <History className="size-4 text-indigo-500" />
              Histórico de cobrança
            </DropdownMenuItem>
          </>
        )}
        {entry.status !== "CANCELLED" ? (
          <DropdownMenuItem onClick={onCancel} className="gap-2 text-amber-500">
            <XCircle className="size-4" />
            Cancelar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-500">
            <Trash2 className="size-4" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
