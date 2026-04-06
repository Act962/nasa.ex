"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  CheckCircle2,
  Trash2,
  Search,
  Plus,
} from "lucide-react";
import {
  usePaymentEntries,
  useCreatePaymentEntry,
  usePayEntry,
  useDeletePaymentEntry,
} from "../../hooks/use-payment";
import {
  formatCurrency,
  formatDate,
  STATUS_LABELS,
  STATUS_COLORS,
  parseCurrencyToCents,
} from "../../lib/format";
import { EntryForm } from "./entry-form";
import { toast } from "sonner";
import { usePaymentAccounts } from "../../hooks/use-payment";

interface EntriesTableProps {
  type: "RECEIVABLE" | "PAYABLE";
}

export function EntriesTable({ type }: EntriesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [payDialog, setPayDialog] = useState<{ id: string; amount: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const { data, isLoading } = usePaymentEntries({
    type,
    search: search || undefined,
    status: (statusFilter as "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED") || undefined,
  });

  const { data: accountsData } = usePaymentAccounts();
  const createEntry = useCreatePaymentEntry();
  const payEntry = usePayEntry();
  const deleteEntry = useDeletePaymentEntry();

  async function handleCreate(formData: Parameters<typeof createEntry.mutateAsync>[0]) {
    try {
      await createEntry.mutateAsync(formData);
      setShowForm(false);
      toast.success(type === "RECEIVABLE" ? "Conta a receber criada!" : "Conta a pagar criada!");
    } catch {
      toast.error("Erro ao criar lançamento");
    }
  }

  async function handlePay() {
    if (!payDialog) return;
    const amount = parseCurrencyToCents(payAmount);
    if (!amount) return toast.error("Valor inválido");
    try {
      await payEntry.mutateAsync({ id: payDialog.id, paidAmount: amount });
      setPayDialog(null);
      setPayAmount("");
      toast.success("Pagamento registrado!");
    } catch {
      toast.error("Erro ao registrar pagamento");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteEntry.mutateAsync({ id });
      toast.success("Lançamento cancelado");
    } catch {
      toast.error("Erro ao cancelar");
    }
  }

  const entries = data?.entries ?? [];
  const typeLabel = type === "RECEIVABLE" ? "Receber" : "Pagar";
  const color = type === "RECEIVABLE" ? "text-green-400" : "text-red-400";

  const totalPending = entries
    .filter((e) => ["PENDING", "PARTIAL", "OVERDUE"].includes(e.status))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total pendente</p>
          <p className={`text-2xl font-black ${color}`}>{formatCurrency(totalPending)}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(true)}
          className="bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white gap-1.5"
        >
          <Plus className="size-4" />
          Novo a {typeLabel}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9 h-8 text-sm"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-xs bg-muted border border-border rounded-lg px-2.5 py-1.5 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Descrição</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Contato</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Valor</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-medium">Vencimento</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-center px-4 py-3 text-xs text-muted-foreground font-medium">Categoria</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">Carregando...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm leading-tight">{entry.description}</div>
                    {entry.installmentTotal && (
                      <div className="text-xs text-muted-foreground">
                        Parcela {entry.installmentCurrent}/{entry.installmentTotal}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.contact?.name ?? "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${color}`}>
                    {formatCurrency(entry.amount)}
                    {entry.paidAmount > 0 && entry.paidAmount < entry.amount && (
                      <div className="text-xs text-muted-foreground font-normal">
                        Pago: {formatCurrency(entry.paidAmount)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {formatDate(entry.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[entry.status]}`}
                    >
                      {STATUS_LABELS[entry.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                    {entry.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {["PENDING", "PARTIAL", "OVERDUE"].includes(entry.status) && (
                          <DropdownMenuItem
                            onClick={() => {
                              setPayDialog({ id: entry.id, amount: entry.amount - entry.paidAmount });
                              setPayAmount("");
                            }}
                            className="gap-2"
                          >
                            <CheckCircle2 className="size-4 text-green-400" />
                            Registrar Pagamento
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(entry.id)}
                          className="gap-2 text-red-400"
                        >
                          <Trash2 className="size-4" />
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total */}
      {entries.length > 0 && (
        <div className="flex justify-between text-sm px-1">
          <span className="text-muted-foreground">{data?.total ?? entries.length} lançamentos</span>
          <span className="font-semibold">
            Total: <span className={color}>{formatCurrency(entries.reduce((s, e) => s + e.amount, 0))}</span>
          </span>
        </div>
      )}

      {/* Create Entry Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`text-base ${color}`}>{type === "RECEIVABLE" ? "💚" : "🔴"}</span>
              Nova Conta a {typeLabel}
            </DialogTitle>
          </DialogHeader>
          <EntryForm
            type={type}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createEntry.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input
                placeholder="R$ 0,00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
              {payDialog && (
                <p className="text-xs text-muted-foreground">
                  Saldo: {formatCurrency(payDialog.amount)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Conta bancária</Label>
              <select className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 focus:outline-none">
                <option value="">Selecionar...</option>
                {accountsData?.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setPayDialog(null)}>Cancelar</Button>
              <Button
                className="flex-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                onClick={handlePay}
                disabled={payEntry.isPending}
              >
                {payEntry.isPending ? "Salvando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
