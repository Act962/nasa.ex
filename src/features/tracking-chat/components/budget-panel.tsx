"use client";

import { useState, useMemo } from "react";
import {
  DollarSignIcon,
  XIcon,
  Loader2,
  PlusIcon,
  ListIcon,
  CheckCircleIcon,
  PencilIcon,
  Trash2Icon,
  ClockIcon,
  AlertCircleIcon,
  SendIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  formatCurrency,
  parseCurrencyToCents,
} from "@/features/payment/lib/format";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

/**
 * Painel "Orçamento" do chat — UI completa com:
 *  - Tab "Criar"    → form de novo orçamento (envia msg + cria A receber)
 *  - Tab "Histórico" → lista de orçamentos já enviados pro mesmo lead, com:
 *      • Status (Pendente / Parcial / Pago / Vencido)
 *      • Botão "Editar" (pré-preenche o form na aba Criar)
 *      • Botão "Registrar pagamento" (marca como PAID, atualiza dashboard)
 *      • Botão "Excluir" (apenas pra status PENDING)
 *
 * Evita orçamentos duplicados: o atendente vê o que já mandou antes de
 * mandar mais. Bota o foco em editar/registrar quando for o caso.
 */
interface BudgetPanelProps {
  onClose: () => void;
  conversationId: string;
  trackingId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  whatsappToken: string;
  onInsertMessage: (text: string) => void;
}

type StatusFilter = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const STATUS_META: Record<
  StatusFilter,
  { label: string; className: string; Icon: typeof ClockIcon }
> = {
  PENDING: {
    label: "Pendente",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    Icon: ClockIcon,
  },
  PARTIAL: {
    label: "Parcial",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Icon: ClockIcon,
  },
  PAID: {
    label: "Pago",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    Icon: CheckCircleIcon,
  },
  OVERDUE: {
    label: "Vencido",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    Icon: AlertCircleIcon,
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    Icon: XIcon,
  },
};

export function BudgetPanel({
  onClose,
  conversationId,
  trackingId,
  leadId,
  leadName,
  leadPhone,
  whatsappToken,
  onInsertMessage,
}: BudgetPanelProps) {
  const [tab, setTab] = useState<"create" | "history">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state — pode ser usado pra criar OU editar (quando editingId !== null).
  const [valueStr, setValueStr] = useState("");
  const [description, setDescription] = useState("");
  const [dueDays, setDueDays] = useState(7);

  const cents = useMemo(() => parseCurrencyToCents(valueStr), [valueStr]);
  const formatted = useMemo(
    () => (cents > 0 ? formatCurrency(cents) : ""),
    [cents],
  );

  const isEditing = editingId !== null;

  // ── Queries ─────────────────────────────────────────────────────────────
  const entriesQuery = useQuery(
    orpc.payment.entries.list.queryOptions({
      input: {
        leadId,
        type: "RECEIVABLE",
        perPage: 50,
      },
    }),
  );
  const entries = entriesQuery.data?.entries ?? [];

  // ── Mutations ───────────────────────────────────────────────────────────
  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.payment.entries.list.queryKey({
        input: { leadId, type: "RECEIVABLE", perPage: 50 },
      }),
    });
    // Invalida qualquer cache de payment pra refletir no dashboard global.
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        q.queryKey[0].includes("payment"),
    });
  };

  const sendMessage = useMutation(orpc.message.create.mutationOptions());
  const createReceivable = useMutation(
    orpc.payment.entries.create.mutationOptions({ onSuccess: invalidateAll }),
  );
  const updateReceivable = useMutation(
    orpc.payment.entries.update.mutationOptions({ onSuccess: invalidateAll }),
  );
  const payReceivable = useMutation(
    orpc.payment.entries.pay.mutationOptions({ onSuccess: invalidateAll }),
  );
  const deleteReceivable = useMutation(
    orpc.payment.entries.delete.mutationOptions({ onSuccess: invalidateAll }),
  );

  const isPending =
    sendMessage.isPending ||
    createReceivable.isPending ||
    updateReceivable.isPending ||
    payReceivable.isPending ||
    deleteReceivable.isPending;

  // ── Handlers ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingId(null);
    setValueStr("");
    setDescription("");
    setDueDays(7);
  };

  const startEdit = (entry: (typeof entries)[number]) => {
    setEditingId(entry.id);
    setValueStr(formatCurrency(entry.amount).replace("R$", "").trim());
    // Strip "Orçamento — <lead>: " do começo da descrição se houver
    const prefix = `Orçamento — ${leadName}: `;
    const cleanDesc = entry.description.startsWith(prefix)
      ? entry.description.slice(prefix.length)
      : entry.description;
    setDescription(cleanDesc);
    const daysUntilDue = Math.max(
      1,
      Math.round(
        (new Date(entry.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ),
    );
    setDueDays(daysUntilDue);
    setTab("create");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!description.trim()) {
      toast.error("Descreva o que o orçamento cobre.");
      return;
    }

    const fullDesc = `Orçamento — ${leadName}: ${description.trim()}`;
    const dueDate = addDays(new Date(), dueDays).toISOString();

    try {
      if (isEditing) {
        // EDIÇÃO — não envia nova mensagem (atendente edita registro silenciosamente).
        await updateReceivable.mutateAsync({
          id: editingId!,
          description: fullDesc,
          amount: cents,
          dueDate,
        });
        toast.success("Orçamento atualizado.");
        resetForm();
        setTab("history");
      } else {
        // CRIAÇÃO — envia mensagem + cria A receber.
        const messageBody = `💰 *Orçamento:* ${formatCurrency(cents)}\n${description.trim()}`;
        await sendMessage.mutateAsync({
          conversationId,
          body: messageBody,
          leadPhone,
          token: whatsappToken,
        });
        await createReceivable.mutateAsync({
          type: "RECEIVABLE",
          description: fullDesc,
          amount: cents,
          dueDate,
          trackingId,
          leadId,
        });
        toast.success(
          `Orçamento de ${formatCurrency(cents)} enviado e lançado em "A receber".`,
        );
        resetForm();
        setTab("history");
      }
    } catch (err) {
      toast.error(
        `${isEditing ? "Falhou ao atualizar" : "Falhou ao enviar orçamento"}: ${(err as Error).message}`,
      );
    }
  };

  const handlePay = (entry: (typeof entries)[number]) => {
    const remaining = entry.amount - entry.paidAmount;
    if (remaining <= 0) {
      toast.info("Esse orçamento já está pago.");
      return;
    }
    payReceivable.mutate(
      { id: entry.id, paidAmount: remaining },
      {
        onSuccess: () =>
          toast.success(
            `Pagamento de ${formatCurrency(remaining)} registrado.`,
          ),
        onError: (err) =>
          toast.error(`Falhou ao registrar: ${(err as Error).message}`),
      },
    );
  };

  const handleDelete = (entry: (typeof entries)[number]) => {
    if (entry.status !== "PENDING") {
      toast.info("Só dá pra excluir orçamentos pendentes.");
      return;
    }
    if (!confirm(`Excluir orçamento de ${formatCurrency(entry.amount)}?`)) {
      return;
    }
    deleteReceivable.mutate(
      { id: entry.id },
      {
        onSuccess: () => toast.success("Orçamento excluído."),
        onError: (err) =>
          toast.error(`Falhou ao excluir: ${(err as Error).message}`),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-w-lg flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b px-5 py-3 text-left">
          <div className="flex items-center gap-2">
            <DollarSignIcon className="size-4 text-emerald-500" />
            <DialogTitle className="text-sm font-semibold">
              Orçamento — {leadName}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "create" | "history");
            if (v === "create" && !isEditing) {
              // Limpa form quando entra em "Criar" vindo do histórico sem edição
            }
          }}
          className="flex w-full flex-col"
        >
          <div className="px-5 pt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-1.5">
                <PlusIcon className="size-3.5" />
                {isEditing ? "Editar" : "Criar"}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex items-center gap-1.5"
              >
                <ListIcon className="size-3.5" />
                Histórico ({entries.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab CRIAR / EDITAR ────────────────────────────────────── */}
          <TabsContent
            value="create"
            className="m-0 border-none outline-none"
          >
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              {isEditing && (
                <div className="rounded-md bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
                  Editando orçamento existente. A mensagem no chat <strong>não</strong>{" "}
                  será reenviada.
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="budget-value">Valor (R$)*</Label>
                <Input
                  id="budget-value"
                  placeholder="1500,00"
                  value={valueStr}
                  onChange={(e) => setValueStr(e.target.value)}
                  autoFocus
                  inputMode="decimal"
                />
                {formatted && (
                  <p className="text-xs text-muted-foreground">
                    Será {isEditing ? "atualizado" : "lançado"} como{" "}
                    <strong>{formatted}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budget-desc">Descrição*</Label>
                <Textarea
                  id="budget-desc"
                  placeholder="Ex: Pacote completo de consultoria mensal"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budget-due">Vencimento</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="budget-due"
                    type="number"
                    min={1}
                    max={365}
                    value={dueDays}
                    onChange={(e) => setDueDays(Number(e.target.value) || 7)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    dias a partir de hoje
                  </span>
                </div>
              </div>

              {!isEditing && cents > 0 && description.trim() && (
                <div className="rounded-md border border-dashed p-3 text-xs">
                  <p className="mb-1 font-semibold text-muted-foreground">
                    Mensagem no chat:
                  </p>
                  <p className="whitespace-pre-wrap">
                    💰 <strong>Orçamento:</strong> {formatted}
                    <br />
                    {description.trim()}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-3">
                {isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    disabled={isPending}
                  >
                    Cancelar edição
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isPending || cents <= 0 || !description.trim()}
                  className="gap-1.5"
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {isEditing ? (
                    "Salvar alterações"
                  ) : (
                    <>
                      <SendIcon className="size-3.5" /> Enviar orçamento
                    </>
                  )}
                </Button>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    if (cents <= 0 || !description.trim()) return;
                    onInsertMessage(
                      `💰 *Orçamento:* ${formatCurrency(cents)}\n${description.trim()}`,
                    );
                    onClose();
                  }}
                  disabled={isPending || cents <= 0 || !description.trim()}
                  className="w-full text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  Apenas anexar texto ao input (sem enviar nem lançar A receber)
                </button>
              )}
            </form>
          </TabsContent>

          {/* ── Tab HISTÓRICO ──────────────────────────────────────────── */}
          <TabsContent
            value="history"
            className="m-0 border-none outline-none"
          >
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {entriesQuery.isLoading ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Carregando histórico...
                </p>
              ) : entries.length === 0 ? (
                <div className="py-10 text-center">
                  <DollarSignIcon className="mx-auto size-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-medium">
                    Nenhum orçamento ainda
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vá em "Criar" pra mandar o primeiro pro {leadName}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const status = entry.status as StatusFilter;
                    const meta = STATUS_META[status];
                    const remaining = entry.amount - entry.paidAmount;
                    const isPaid = status === "PAID";
                    const isCancelled = status === "CANCELLED";
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "rounded-md border p-3 transition-colors",
                          editingId === entry.id &&
                            "border-primary/40 bg-primary/5",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {formatCurrency(entry.amount)}
                            </p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {entry.description.replace(
                                `Orçamento — ${leadName}: `,
                                "",
                              )}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>
                                Venc.: {dayjs(entry.dueDate).format("DD/MM/YYYY")}
                              </span>
                              <span>·</span>
                              <span>
                                Criado:{" "}
                                {dayjs(entry.createdAt).format("DD/MM HH:mm")}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 gap-1 px-1.5 py-0 text-[10px]",
                              meta.className,
                            )}
                          >
                            <meta.Icon className="size-2.5" />
                            {meta.label}
                          </Badge>
                        </div>

                        {entry.paidAmount > 0 && !isPaid && (
                          <p className="mt-1 text-[10px] text-blue-600 dark:text-blue-400">
                            Já pago: {formatCurrency(entry.paidAmount)} · Restante:{" "}
                            <strong>{formatCurrency(remaining)}</strong>
                          </p>
                        )}

                        {!isCancelled && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {!isPaid && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={isPending}
                                onClick={() => handlePay(entry)}
                              >
                                <CheckCircleIcon className="size-3" />
                                Registrar pagamento
                              </Button>
                            )}
                            {status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={isPending}
                                onClick={() => startEdit(entry)}
                              >
                                <PencilIcon className="size-3" />
                                Editar
                              </Button>
                            )}
                            {status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                                disabled={isPending}
                                onClick={() => handleDelete(entry)}
                              >
                                <Trash2Icon className="size-3" />
                                Excluir
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
