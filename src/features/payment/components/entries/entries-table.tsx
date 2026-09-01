"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Pencil, Search, Plus } from "lucide-react";
import { EntryActionsMenu } from "./entry-actions-menu";
import { DunningAssignDialog } from "../dunning/dunning-assign-dialog";
import { DunningHistoryDrawer } from "../dunning/dunning-history-drawer";
import {
  usePaymentEntries,
  useCreatePaymentEntry,
  usePayEntry,
  useDeletePaymentEntry,
  useRemovePaymentEntry,
} from "../../hooks/use-payment";
import { EntryEditDialog } from "./entry-edit-dialog";
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
import {
  usePaymentPeriod,
  usePaymentCategoryFilter,
} from "../../store/use-payment-filters-store";

interface EntriesTableProps {
  type: "RECEIVABLE" | "PAYABLE";
}

type PaymentEntryRow = NonNullable<
  ReturnType<typeof usePaymentEntries>["data"]
>["entries"][number];

export function EntriesTable({ type }: EntriesTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [payDialog, setPayDialog] = useState<{ id: string; amount: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  // Edição de valores + confirmação de cancelar (soft) / excluir (hard).
  const [editEntry, setEditEntry] = useState<PaymentEntryRow | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "cancel" | "delete"; id: string; name: string } | null
  >(null);
  // ── Dunning (Fase 2) — atribuir régua + ver histórico de execuções.
  const [assignDunning, setAssignDunning] = useState<{ id: string; ruleId: string | null; name: string } | null>(null);
  const [historyDunning, setHistoryDunning] = useState<{ id: string; name: string } | null>(null);

  const period = usePaymentPeriod();
  const categoryIds = usePaymentCategoryFilter();

  const { data, isLoading } = usePaymentEntries({
    type,
    categoryIds,
    search: search || undefined,
    status: (statusFilter as "PENDING_APPROVAL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED") || undefined,
    dateFrom: period.from?.toISOString(),
    dateTo: period.to?.toISOString(),
  });

  const { data: accountsData } = usePaymentAccounts();
  const createEntry = useCreatePaymentEntry();
  const payEntry = usePayEntry();
  const deleteEntry = useDeletePaymentEntry();
  const removeEntry = useRemovePaymentEntry();

  async function handleCreate(formData: Parameters<typeof createEntry.mutateAsync>[0]) {
    try {
      await createEntry.mutateAsync(formData);
      setShowForm(false);
      toast.success(type === "RECEIVABLE" ? "Receita criada!" : "Despesa criada!");
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

  async function handleRemove(id: string) {
    try {
      await removeEntry.mutateAsync({ id });
      toast.success("Lançamento excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  function openPayDialog(entry: PaymentEntryRow) {
    setPayDialog({ id: entry.id, amount: entry.amount - entry.paidAmount });
    setPayAmount("");
  }

  function openAssignDunning(entry: PaymentEntryRow) {
    setAssignDunning({
      id: entry.id,
      ruleId: (entry as { dunningRuleId?: string | null }).dunningRuleId ?? null,
      name: entry.description,
    });
  }

  async function handleConfirm() {
    if (!confirm) return;
    if (confirm.kind === "cancel") await handleDelete(confirm.id);
    else await handleRemove(confirm.id);
    setConfirm(null);
  }

  const entries = data?.entries ?? [];
  const typeLabel = type === "RECEIVABLE" ? "Receita" : "Despesa";
  const color = type === "RECEIVABLE" ? "text-green-400" : "text-red-400";

  const totalPending = entries
    .filter((e) => ["PENDING", "PARTIAL", "OVERDUE"].includes(e.status))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total pendente</p>
          <p className={`text-2xl font-black ${color}`}>{formatCurrency(totalPending)}</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="h-9 w-full gap-1.5 bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90 sm:w-auto"
        >
          <Plus className="size-4" />
          Nova {typeLabel}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9 text-sm"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 flex-1 min-w-32 rounded-lg border border-border bg-muted px-2.5 text-xs focus:outline-none sm:flex-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista em cards — mobile. A tabela larga vira scroll horizontal e
          quebra a página em telas pequenas, então abaixo de md usamos cards. */}
      <div className="space-y-2 md:hidden">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Carregando...
          </p>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum lançamento encontrado
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-border/50 bg-card p-3"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {entry.description}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.contact?.name ?? "Sem contato"}
                    {entry.category?.name ? ` · ${entry.category.name}` : ""}
                    {entry.installmentTotal
                      ? ` · Parcela ${entry.installmentCurrent}/${entry.installmentTotal}`
                      : ""}
                  </p>
                </div>
                <EntryActionsMenu
                  entry={entry}
                  onPay={() => openPayDialog(entry)}
                  onEdit={() => setEditEntry(entry)}
                  onAssignDunning={() => openAssignDunning(entry)}
                  onDunningHistory={() =>
                    setHistoryDunning({ id: entry.id, name: entry.description })
                  }
                  onCancel={() =>
                    setConfirm({ kind: "cancel", id: entry.id, name: entry.description })
                  }
                  onDelete={() =>
                    setConfirm({ kind: "delete", id: entry.id, name: entry.description })
                  }
                  className="-mr-1 shrink-0"
                />
              </div>

              <div className="mt-2.5 flex items-end justify-between gap-2 border-t pt-2.5">
                <div className="min-w-0">
                  <p className={`text-base font-bold tabular-nums ${color}`}>
                    {formatCurrency(entry.amount)}
                  </p>
                  {entry.paidAmount > 0 && entry.paidAmount < entry.amount && (
                    <p className="text-xs text-muted-foreground">
                      Pago: {formatCurrency(entry.paidAmount)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${STATUS_COLORS[entry.status]}`}
                  >
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    Venc. {formatDate(entry.dueDate)}
                  </span>
                </div>
              </div>

              {["PENDING", "PARTIAL", "OVERDUE"].includes(entry.status) && (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => openPayDialog(entry)}
                  >
                    <CheckCircle2 className="size-4 text-green-500" />
                    Pagar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => setEditEntry(entry)}
                  >
                    <Pencil className="size-4 text-blue-500" />
                    Editar
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden overflow-hidden rounded-xl border border-border/50 md:block">
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
                    <EntryActionsMenu
                      entry={entry}
                      onPay={() => openPayDialog(entry)}
                      onEdit={() => setEditEntry(entry)}
                      onAssignDunning={() => openAssignDunning(entry)}
                      onDunningHistory={() =>
                        setHistoryDunning({ id: entry.id, name: entry.description })
                      }
                      onCancel={() =>
                        setConfirm({ kind: "cancel", id: entry.id, name: entry.description })
                      }
                      onDelete={() =>
                        setConfirm({ kind: "delete", id: entry.id, name: entry.description })
                      }
                    />
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scroll-cols-tracking">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`text-base ${color}`}>{type === "RECEIVABLE" ? "💚" : "🔴"}</span>
              Nova {typeLabel}
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

      {/* Dunning — atribuir régua */}
      <DunningAssignDialog
        entryId={assignDunning?.id ?? null}
        initialRuleId={assignDunning?.ruleId ?? null}
        entryName={assignDunning?.name}
        onClose={() => setAssignDunning(null)}
      />

      {/* Dunning — histórico de execuções */}
      <DunningHistoryDrawer
        entryId={historyDunning?.id ?? null}
        entryName={historyDunning?.name ?? null}
        onClose={() => setHistoryDunning(null)}
      />

      {/* Editar lançamento */}
      <EntryEditDialog entry={editEntry} onClose={() => setEditEntry(null)} />

      {/* Confirmação de cancelar (soft) / excluir (hard) */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" ? "Excluir lançamento?" : "Cancelar lançamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete" ? (
                <>
                  O lançamento <strong>{confirm?.name}</strong> será removido
                  permanentemente e não poderá ser recuperado.
                </>
              ) : (
                <>
                  O lançamento <strong>{confirm?.name}</strong> será marcado como
                  cancelado, mas continuará no histórico.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEntry.isPending || removeEntry.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={deleteEntry.isPending || removeEntry.isPending}
              className={
                confirm?.kind === "delete"
                  ? "bg-red-500 hover:bg-red-500/90 text-white"
                  : "bg-amber-500 hover:bg-amber-500/90 text-white"
              }
            >
              {confirm?.kind === "delete" ? "Excluir" : "Cancelar lançamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
