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
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

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
          data-guide={
            PAYABLE_STATUSES.includes(entry.status) ? GUIDE_ANCHORS.paymentOpenEntryMenu.id : undefined
          }
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {PAYABLE_STATUSES.includes(entry.status) && (
          <DropdownMenuItem
            onClick={onPay}
            className="gap-2"
            data-guide={GUIDE_ANCHORS.paymentRegisterPayment.id}
          >
            <CheckCircle2 className="size-4 text-success" />
            Registrar pagamento
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Pencil className="size-4 text-info" />
          Editar
        </DropdownMenuItem>
        {entry.type === "RECEIVABLE" && (
          <>
            <DropdownMenuItem onClick={onAssignDunning} className="gap-2">
              <Bell className="size-4 text-warning" />
              Atribuir régua de cobrança
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDunningHistory} className="gap-2">
              <History className="size-4 text-info" />
              Histórico de cobrança
            </DropdownMenuItem>
          </>
        )}
        {entry.status !== "CANCELLED" ? (
          <DropdownMenuItem onClick={onCancel} className="gap-2 text-warning">
            <XCircle className="size-4" />
            Cancelar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive">
            <Trash2 className="size-4" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
