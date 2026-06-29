"use client";

import { useMemo } from "react";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  DollarSignIcon,
  EyeIcon,
  FileTextIcon,
  LinkIcon,
  Share2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/features/payment/lib/format";
import {
  useDeleteForgeProposal,
  useForgeProposals,
} from "@/features/forge/hooks/use-forge";
import { useQuery } from "@tanstack/react-query";

type StatusFilter =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

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

const FORGE_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  RASCUNHO: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  ENVIADA: {
    label: "Enviada",
    className: "bg-blue-500/15 text-blue-600",
  },
  ACEITA: {
    label: "Aceita",
    className: "bg-emerald-500/15 text-emerald-600",
  },
  RECUSADA: {
    label: "Recusada",
    className: "bg-red-500/15 text-red-600",
  },
  EXPIRADA: {
    label: "Expirada",
    className: "bg-yellow-500/15 text-yellow-600",
  },
  PAGA: { label: "Paga", className: "bg-emerald-500/15 text-emerald-600" },
};

/** Item unificado pra renderização ordenada cronologicamente. */
type HistoryItem =
  | {
      kind: "budget";
      id: string;
      createdAt: Date;
      data: {
        id: string;
        amount: number;
        paidAmount: number;
        description: string;
        dueDate: Date | string;
        status: string;
        attachmentUrl?: string | null;
      };
    }
  | {
      kind: "proposal";
      id: string;
      createdAt: Date;
      data: {
        id: string;
        number: number;
        title: string;
        publicToken: string;
        status: string;
        validUntil?: Date | string | null;
        products: Array<{ unitValue: string | number; quantity: string | number }>;
      };
    };

interface UnifiedHistoryViewProps {
  leadId: string;
  leadName: string;
  onInsertMessage: (text: string) => void;
}

/**
 * Histórico cronológico unificado de Orçamentos (PaymentEntry) e
 * Propostas Estruturadas (ForgeProposal) do mesmo lead.
 *
 * Cada card tem badge de tipo + ações contextuais:
 *  - Orçamento: Registrar pagamento, Editar (TODO), Excluir
 *  - Proposta: Visualizar, Copiar link, Enviar link no chat, Excluir
 */
export function UnifiedHistoryView({
  leadId,
  leadName,
  onInsertMessage,
}: UnifiedHistoryViewProps) {
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────
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

  const proposalsQuery = useForgeProposals({ clientId: leadId });
  const proposals = proposalsQuery.data?.proposals ?? [];

  // ── Mutations ────────────────────────────────────────────────────────
  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.payment.entries.list.queryKey({
        input: { leadId, type: "RECEIVABLE", perPage: 50 },
      }),
    });
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        q.queryKey[0].includes("payment"),
    });
  };

  const payReceivable = useMutation(
    orpc.payment.entries.pay.mutationOptions({ onSuccess: invalidateAll }),
  );
  const deleteReceivable = useMutation(
    orpc.payment.entries.delete.mutationOptions({ onSuccess: invalidateAll }),
  );
  const deleteProposal = useDeleteForgeProposal();

  // ── Unifica + ordena ─────────────────────────────────────────────────
  const items: HistoryItem[] = useMemo(() => {
    const out: HistoryItem[] = [];
    for (const e of entries) {
      out.push({
        kind: "budget",
        id: `budget-${e.id}`,
        createdAt: new Date(e.createdAt),
        data: {
          id: e.id,
          amount: e.amount,
          paidAmount: e.paidAmount,
          description: e.description,
          dueDate: e.dueDate,
          status: e.status as string,
          attachmentUrl: (e as any).attachmentUrl ?? null,
        },
      });
    }
    for (const p of proposals) {
      out.push({
        kind: "proposal",
        id: `proposal-${p.id}`,
        createdAt: new Date(p.createdAt),
        data: {
          id: p.id,
          number: p.number,
          title: p.title,
          publicToken: p.publicToken,
          status: p.status,
          validUntil: p.validUntil,
          products: p.products as any,
        },
      });
    }
    out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return out;
  }, [entries, proposals]);

  const isLoading = entriesQuery.isLoading || proposalsQuery.isLoading;
  const isPending = payReceivable.isPending || deleteReceivable.isPending;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handlePay = (entry: HistoryItem & { kind: "budget" }) => {
    const remaining = entry.data.amount - entry.data.paidAmount;
    if (remaining <= 0) {
      toast.info("Esse orçamento já está pago.");
      return;
    }
    payReceivable.mutate(
      { id: entry.data.id, paidAmount: remaining },
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

  const handleDeleteBudget = (entry: HistoryItem & { kind: "budget" }) => {
    if (entry.data.status !== "PENDING") {
      toast.info("Só dá pra excluir orçamentos pendentes.");
      return;
    }
    if (!confirm(`Excluir orçamento de ${formatCurrency(entry.data.amount)}?`)) {
      return;
    }
    deleteReceivable.mutate(
      { id: entry.data.id },
      {
        onSuccess: () => toast.success("Orçamento excluído."),
        onError: (err) =>
          toast.error(`Falhou ao excluir: ${(err as Error).message}`),
      },
    );
  };

  const handleViewProposal = (token: string) => {
    window.open(`/proposta/${token}`, "_blank");
  };

  const handleCopyProposalLink = (token: string) => {
    const url = `${window.location.origin}/proposta/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleSendProposalLink = (
    token: string,
    number: number,
    title: string,
  ) => {
    const url = `${window.location.origin}/proposta/${token}`;
    onInsertMessage(
      `Link Proposta #${String(number).padStart(4, "0")} - ${title} ${url}`,
    );
    toast.success("Link inserido na mensagem!");
  };

  const handleDeleteProposal = (id: string) => {
    if (!confirm("Excluir esta proposta?")) return;
    deleteProposal.mutate({ id });
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        Carregando histórico...
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <DollarSignIcon className="mx-auto size-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">Nada enviado ainda</p>
        <p className="text-xs text-muted-foreground">
          Crie um orçamento rápido ou uma proposta estruturada pro {leadName}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) =>
        item.kind === "budget" ? (
          <BudgetCard
            key={item.id}
            item={item}
            leadName={leadName}
            isPending={isPending}
            onPay={() => handlePay(item)}
            onDelete={() => handleDeleteBudget(item)}
          />
        ) : (
          <ProposalCard
            key={item.id}
            item={item}
            isPending={deleteProposal.isPending}
            onView={() => handleViewProposal(item.data.publicToken)}
            onCopyLink={() => handleCopyProposalLink(item.data.publicToken)}
            onSendLink={() =>
              handleSendProposalLink(
                item.data.publicToken,
                item.data.number,
                item.data.title,
              )
            }
            onDelete={() => handleDeleteProposal(item.data.id)}
          />
        ),
      )}
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────

function BudgetCard({
  item,
  leadName,
  isPending,
  onPay,
  onDelete,
}: {
  item: HistoryItem & { kind: "budget" };
  leadName: string;
  isPending: boolean;
  onPay: () => void;
  onDelete: () => void;
}) {
  const status = item.data.status as StatusFilter;
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  const remaining = item.data.amount - item.data.paidAmount;
  const isPaid = status === "PAID";
  const isCancelled = status === "CANCELLED";

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="shrink-0 gap-1 px-1.5 py-0 text-[10px]"
            >
              <DollarSignIcon className="size-2.5" />
              Orçamento
            </Badge>
            <p className="truncate text-sm font-semibold">
              {formatCurrency(item.data.amount)}
            </p>
          </div>
          <p className="line-clamp-2 mt-1 text-xs text-muted-foreground">
            {item.data.description.replace(`Orçamento — ${leadName}: `, "")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Venc.: {dayjs(item.data.dueDate).format("DD/MM/YYYY")}</span>
            <span>·</span>
            <span>{dayjs(item.createdAt).format("DD/MM HH:mm")}</span>
            {item.data.attachmentUrl && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <FileTextIcon className="size-2.5" /> PDF anexo
                </span>
              </>
            )}
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

      {item.data.paidAmount > 0 && !isPaid && (
        <p className="mt-1 text-[10px] text-blue-600 dark:text-blue-400">
          Já pago: {formatCurrency(item.data.paidAmount)} · Restante:{" "}
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
              onClick={onPay}
            >
              <CheckCircleIcon className="size-3" />
              Registrar pagamento
            </Button>
          )}
          {status === "PENDING" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
              disabled={isPending}
              onClick={onDelete}
            >
              <Trash2Icon className="size-3" />
              Excluir
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  item,
  isPending,
  onView,
  onCopyLink,
  onSendLink,
  onDelete,
}: {
  item: HistoryItem & { kind: "proposal" };
  isPending: boolean;
  onView: () => void;
  onCopyLink: () => void;
  onSendLink: () => void;
  onDelete: () => void;
}) {
  const total = item.data.products.reduce(
    (sum, p) => sum + Number(p.unitValue) * Number(p.quantity),
    0,
  );
  const meta = FORGE_STATUS_META[item.data.status] ?? FORGE_STATUS_META.RASCUNHO;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="shrink-0 gap-1 px-1.5 py-0 text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20"
            >
              <FileTextIcon className="size-2.5" />
              Proposta
            </Badge>
            <p className="truncate text-sm font-semibold">
              #{String(item.data.number).padStart(4, "0")} — {item.data.title}
            </p>
          </div>
          <p className="mt-1 text-xs font-medium text-primary">
            {formatCurrency(total * 100)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{dayjs(item.createdAt).format("DD/MM HH:mm")}</span>
            {item.data.validUntil && (
              <>
                <span>·</span>
                <span>
                  Válida até{" "}
                  {dayjs(item.data.validUntil).format("DD/MM/YYYY")}
                </span>
              </>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 px-1.5 py-0 text-[10px]",
            meta.className,
          )}
        >
          {meta.label}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onView}
          disabled={isPending}
        >
          <EyeIcon className="size-3" />
          Visualizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onCopyLink}
          disabled={isPending}
        >
          <LinkIcon className="size-3" />
          Copiar link
        </Button>
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onSendLink}
          disabled={isPending}
        >
          <Share2Icon className="size-3" />
          Enviar link
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
          onClick={onDelete}
          disabled={isPending}
        >
          <Trash2Icon className="size-3" />
          Excluir
        </Button>
      </div>
    </div>
  );
}

