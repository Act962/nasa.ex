"use client";

// Aba "Cobranças" (spec 0115, RF-16): cada conta a receber com cliente, com o status do
// pagamento e o do envio dos avisos da régua, lado a lado.

import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  History,
  Link2,
  Mail,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Receipt,
  Search,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useReopenCharge, useSetChargeDunningPause, usePaymentCharges } from "../../hooks/use-payment-charges";
import { useDeletePaymentEntry } from "../../hooks/use-payment";
import { describePaymentError } from "../../lib/describe-error";
import {
  usePaymentCategoryFilter,
  usePaymentPeriodIso,
} from "../../store/use-payment-filters-store";
import { formatCurrency, formatDate, formatTimestampDate } from "../../lib/format";
import { describeDunningFailure } from "../../lib/dunning-failure";
import { phoneMaskFull } from "@/utils/format-phone";
import {
  PAYMENT_SEARCH_DEBOUNCE_MS,
  PaymentPagination,
  PaymentPaginationNav,
} from "../shared/payment-pagination";
import { ChargeLinkDialog } from "./charge-link-dialog";
import { DunningHistoryDrawer } from "../dunning/dunning-history-drawer";
import { DunningRulesTab } from "../dunning/dunning-rules-tab";
import { PayEntryDialog } from "../entries/pay-entry-dialog";
import { ConfirmDeleteDialog } from "../shared/confirm-delete-dialog";
import { ChargePauseDialog } from "./charge-pause-dialog";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "open" | "overdue" | "paid" | "cancelled";
type ChannelFilter = "all" | "WHATSAPP" | "EMAIL" | "none";
type ChargeRow = NonNullable<ReturnType<typeof usePaymentCharges>["data"]>["charges"][number];
/** Uma parcela (ou cobrança avulsa) — o que os helpers de linha precisam. */
type ChargeItem = Omit<ChargeRow, "rowKey" | "group" | "installments">;

const STATUS_META: Record<ChargeRow["status"], { label: string; className: string }> = {
  OPEN: { label: "A vencer", className: "border-warning/40 bg-warning/10 text-warning" },
  OVERDUE: { label: "Atrasada", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  PAID: { label: "Paga", className: "border-success/40 bg-success/10 text-success" },
  CANCELLED: { label: "Cancelada", className: "border-border bg-muted text-muted-foreground" },
  AWAITING_APPROVAL: { label: "Em aprovação", className: "border-info/40 bg-info/10 text-info" },
};

const CHANNEL_META = {
  WHATSAPP: { label: "WhatsApp", Icon: MessageSquare, className: "text-success" },
  EMAIL: { label: "E-mail", Icon: Mail, className: "text-info" },
  SMS: { label: "SMS", Icon: MessageSquare, className: "text-muted-foreground" },
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function describeDueDate(dueDate: Date, status: ChargeItem["status"]): string | null {
  if (status !== "OPEN" && status !== "OVERDUE") return null;
  const today = new Date();
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(dueDate);
  const startOfDue = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((startOfDue - startOfToday) / MS_PER_DAY);
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `em ${days} dias`;
  return days === -1 ? "há 1 dia" : `há ${Math.abs(days)} dias`;
}

/** Cliente sem o dado que o canal da régua precisa: o aviso vai falhar na hora de sair. */
function findMissingContact(charge: ChargeItem): string | null {
  if (!charge.isOpen || !charge.customer) return null;
  if (charge.channels.includes("WHATSAPP") && !charge.customer.phone) return "Cliente sem telefone para o WhatsApp";
  if (charge.channels.includes("EMAIL") && !charge.customer.email) return "Cliente sem e-mail";
  return null;
}

export function ChargesTab() {
  const { dateFrom, dateTo } = usePaymentPeriodIso();
  const categoryIds = usePaymentCategoryFilter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [page, setPage] = useState(1);
  const [payEntry, setPayEntry] = useState<{ id: string; openAmountCents: number } | null>(null);
  const [linkEntry, setLinkEntry] = useState<{ id: string; name: string } | null>(null);
  const [historyEntry, setHistoryEntry] = useState<{ id: string; name: string } | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());
  const [pauseEntry, setPauseEntry] = useState<{ id: string; name: string } | null>(null);
  const [cancelEntry, setCancelEntry] = useState<{ id: string; name: string } | null>(null);
  const setDunningPause = useSetChargeDunningPause();
  const reopenCharge = useReopenCharge();
  const cancelCharge = useDeletePaymentEntry();

  const debouncedSearch = useDebouncedValue(search.trim(), PAYMENT_SEARCH_DEBOUNCE_MS);

  const filterKey = [debouncedSearch, statusFilter, channelFilter, dateFrom, dateTo, categoryIds?.join(",")].join("|");
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const { data, isLoading } = usePaymentCharges({
    dateFrom,
    dateTo,
    categoryIds,
    status: statusFilter,
    channel: channelFilter,
    search: debouncedSearch || undefined,
    page,
    perPage: PAGE_SIZE,
  });

  const charges = data?.charges ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary;

  const summaryCards: Array<{
    status: StatusFilter;
    label: string;
    hint: string;
    Icon: typeof Receipt;
    iconClassName: string;
    value?: { count: number; amountCents: number };
  }> = [
    { status: "all", label: "Total no período", hint: "cobranças", Icon: Receipt, iconClassName: "bg-info/15 text-info", value: summary?.total },
    { status: "paid", label: "Recebidas", hint: "pagas", Icon: CheckCircle2, iconClassName: "bg-success/15 text-success", value: summary?.paid },
    { status: "open", label: "A vencer", hint: "em aberto", Icon: CalendarClock, iconClassName: "bg-warning/15 text-warning", value: summary?.open },
    { status: "overdue", label: "Atrasadas", hint: "inclui meses anteriores", Icon: AlertTriangle, iconClassName: "bg-destructive/15 text-destructive", value: summary?.overdue },
  ];

  function handleResumeDunning(charge: ChargeItem) {
    setDunningPause.mutate(
      { entryId: charge.id, pausedUntil: null },
      {
        onSuccess: () => toast.success("Avisos retomados"),
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível retomar")),
      },
    );
  }

  function handleReopen(charge: ChargeItem) {
    reopenCharge.mutate(
      { entryId: charge.id },
      {
        onSuccess: () => toast.success("Cobrança reaberta"),
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível reabrir")),
      },
    );
  }

  function handleCancel() {
    if (!cancelEntry) return;
    cancelCharge.mutate(
      { id: cancelEntry.id },
      {
        onSuccess: () => {
          setCancelEntry(null);
          toast.success("Cobrança cancelada");
        },
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível cancelar")),
      },
    );
  }

  function toggleSeries(rowKey: string) {
    setExpandedRowKeys((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  function renderSeriesSummary(charge: ChargeRow) {
    if (!charge.group) return null;
    const isExpanded = expandedRowKeys.has(charge.rowKey);
    return (
      <button
        type="button"
        onClick={() => toggleSeries(charge.rowKey)}
        aria-expanded={isExpanded}
        className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("size-3 transition-transform", isExpanded && "rotate-180")} />
        {charge.group.installmentTotal} parcelas · {charge.group.paidCount} paga{charge.group.paidCount === 1 ? "" : "s"} ·{" "}
        {charge.group.openCount} em aberto
      </button>
    );
  }

  /** Parcelas da série que não estão em destaque, em ordem; cada uma com o próprio menu. */
  function renderSeriesInstallments(charge: ChargeRow) {
    return (
      <div className="divide-y divide-border/40 rounded-lg border border-border/40 bg-muted/20">
        {charge.installments.map((installment) => (
          <div key={installment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
            <span className="w-24 shrink-0 font-medium">Parcela {installment.installmentLabel ?? "—"}</span>
            <span className="w-28 shrink-0 text-muted-foreground">
              {installment.status === "PAID" && installment.paidAt
                ? `Paga em ${formatTimestampDate(installment.paidAt)}`
                : `Vence ${formatDate(installment.dueDate)}`}
            </span>
            <span className="w-24 shrink-0">{renderAmount(installment)}</span>
            <span className="min-w-0 flex-1">{renderDelivery(installment)}</span>
            {renderStatus(installment)}
            {renderRowActions(installment)}
          </div>
        ))}
      </div>
    );
  }

  function renderRowActions(charge: ChargeItem) {
    const name = charge.customer?.name ?? charge.description;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Ações da cobrança">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {charge.isOpen && (
            <>
              <DropdownMenuItem onClick={() => setLinkEntry({ id: charge.id, name: charge.description })}>
                <Link2 className="size-4" />
                Link de pagamento
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPayEntry({ id: charge.id, openAmountCents: charge.openAmountCents })}
              >
                <CheckCircle2 className="size-4" />
                Marcar como paga
              </DropdownMenuItem>
              {charge.rule &&
                (charge.dunningPausedUntil ? (
                  <DropdownMenuItem onClick={() => handleResumeDunning(charge)}>
                    <PlayCircle className="size-4" />
                    Retomar avisos
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setPauseEntry({ id: charge.id, name: charge.description })}>
                    <PauseCircle className="size-4" />
                    Pausar avisos
                  </DropdownMenuItem>
                ))}
            </>
          )}
          <DropdownMenuItem onClick={() => setHistoryEntry({ id: charge.id, name })}>
            <History className="size-4" />
            Histórico de avisos
          </DropdownMenuItem>
          {(charge.isOpen || charge.status === "CANCELLED") && <DropdownMenuSeparator />}
          {charge.isOpen && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setCancelEntry({ id: charge.id, name: charge.description })}
            >
              <Ban className="size-4" />
              Cancelar cobrança
            </DropdownMenuItem>
          )}
          {charge.status === "CANCELLED" && (
            <DropdownMenuItem onClick={() => handleReopen(charge)}>
              <RotateCcw className="size-4" />
              Reabrir cobrança
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderDelivery(charge: ChargeItem) {
    if (!charge.rule) {
      return <span className="text-xs text-muted-foreground">Sem cobrança automática</span>;
    }
    const missingContact = findMissingContact(charge);
    return (
      <div className="min-w-0 space-y-1">
        {charge.dunningPausedUntil && (
          <p className="flex items-center gap-1 text-[11px] text-warning">
            <PauseCircle className="size-3 shrink-0" />
            Avisos pausados até {formatDate(charge.dunningPausedUntil)}
          </p>
        )}
        <div className="flex items-center gap-2">
          {charge.channels.length === 0 ? (
            <span className="text-xs text-muted-foreground">Régua sem avisos</span>
          ) : (
            charge.channels.map((channel) => {
              const meta = CHANNEL_META[channel];
              return (
                <span key={channel} className={cn("inline-flex items-center gap-1 text-xs", meta.className)}>
                  <meta.Icon className="size-3.5" />
                  {meta.label}
                </span>
              );
            })
          )}
          {!charge.rule.isActive && (
            <Badge variant="outline" className="text-[10px]">Régua desligada</Badge>
          )}
          {missingContact && (
            <span title={missingContact} className="text-warning">
              <TriangleAlert className="size-3.5" aria-label={missingContact} />
            </span>
          )}
        </div>
        {charge.lastNotice ? (
          charge.lastNotice.status === "SENT" ? (
            <p className="text-[11px] text-muted-foreground">
              Último aviso {charge.lastNotice.readAt
                ? `lido em ${formatTimestampDate(charge.lastNotice.readAt)}`
                : charge.lastNotice.deliveredAt
                  ? `entregue em ${formatTimestampDate(charge.lastNotice.deliveredAt)}`
                  : `enviado em ${formatTimestampDate(charge.lastNotice.executedAt)}`}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-destructive">
              <XCircle className="size-3 shrink-0" />
              <span className="truncate">
                Falhou em {formatTimestampDate(charge.lastNotice.executedAt)}: {describeDunningFailure(charge.lastNotice.errorMessage)}
              </span>
            </p>
          )
        ) : (
          <p className="text-[11px] text-muted-foreground">Nenhum aviso enviado ainda</p>
        )}
      </div>
    );
  }

  function renderAmount(charge: ChargeItem) {
    return (
      <>
        <span className="font-semibold">{formatCurrency(charge.amountCents)}</span>
        {charge.isPartial && (
          <div className="text-[11px] text-muted-foreground">
            Falta {formatCurrency(charge.openAmountCents)}
          </div>
        )}
      </>
    );
  }

  function renderStatus(charge: ChargeItem) {
    const meta = STATUS_META[charge.status];
    return (
      <Badge variant="outline" className={cn("text-[11px]", meta.className)}>
        {charge.isPartial && charge.status !== "PAID" ? `${meta.label} · parcial` : meta.label}
      </Badge>
    );
  }

  const emptyMessage = debouncedSearch || statusFilter !== "all" || channelFilter !== "all"
    ? "Nenhuma cobrança com esses filtros."
    : "Nenhuma cobrança no período. Cobranças são receitas ligadas a um cliente.";

  return (
    <div className="space-y-4" data-guide={GUIDE_ANCHORS.paymentChargesView.id}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <button
            key={card.status}
            type="button"
            onClick={() => setStatusFilter(card.status)}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-left transition-colors hover:bg-muted/30 sm:p-4",
              statusFilter === card.status && "border-primary/50 bg-primary/5",
            )}
          >
            <span className={cn("hidden size-9 shrink-0 place-items-center rounded-full sm:grid", card.iconClassName)}>
              <card.Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">{card.label}</span>
              <span className="block truncate text-base font-bold leading-tight sm:text-lg">
                {card.value ? formatCurrency(card.value.amountCents) : "—"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {card.value ? `${card.value.count} ${card.hint}` : " "}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9 pr-8 text-sm"
            placeholder="Buscar cliente ou descrição..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 min-w-32 flex-1 rounded-lg border border-border bg-muted px-2.5 text-xs focus:outline-none sm:flex-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            aria-label="Status da cobrança"
          >
            <option value="all">Todos os status</option>
            <option value="open">A vencer</option>
            <option value="overdue">Atrasadas</option>
            <option value="paid">Pagas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          <select
            className="h-9 min-w-36 flex-1 rounded-lg border border-border bg-muted px-2.5 text-xs focus:outline-none sm:flex-none"
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)}
            aria-label="Método de envio"
          >
            <option value="all">Todos os métodos</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">E-mail</option>
            <option value="none">Sem cobrança automática</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 sm:ml-auto"
          onClick={() => setIsRulesOpen(true)}
          data-guide={GUIDE_ANCHORS.paymentDunningMessagesButton.id}
        >
          <MessageSquareText className="size-4" />
          Réguas e mensagens
        </Button>
        <PaymentPaginationNav
          page={page}
          total={total}
          perPage={PAGE_SIZE}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>

      {/* Mobile: cards. A tabela larga quebraria a página em tela pequena. */}
      <div className="space-y-2 md:hidden">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : charges.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          charges.map((charge) => (
            <div key={charge.rowKey} className="space-y-2 rounded-xl border border-border/50 bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{charge.customer?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {charge.description}
                    {charge.installmentLabel && ` · Parcela ${charge.installmentLabel}`}
                  </p>
                  {renderSeriesSummary(charge)}
                </div>
                {renderRowActions(charge)}
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="text-sm">{renderAmount(charge)}</div>
                <div className="space-y-1 text-right">
                  {renderStatus(charge)}
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(charge.dueDate)}
                    {describeDueDate(charge.dueDate, charge.status) && ` · ${describeDueDate(charge.dueDate, charge.status)}`}
                  </p>
                </div>
              </div>
              <div className="border-t border-border/40 pt-2">{renderDelivery(charge)}</div>
              {charge.group && expandedRowKeys.has(charge.rowKey) && renderSeriesInstallments(charge)}
            </div>
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-xl border border-border/50 md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Descrição</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-left font-medium">Vencimento</th>
                <th className="px-4 py-3 text-left font-medium">Envio</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Carregando...</td>
                </tr>
              ) : charges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</td>
                </tr>
              ) : (
                charges.map((charge) => {
                  const dueHint = describeDueDate(charge.dueDate, charge.status);
                  return (
                    <Fragment key={charge.rowKey}>
                    <tr className="border-b border-border/30 transition-colors hover:bg-muted/20">
                      <td className="max-w-56 px-4 py-3">
                        <p className="truncate font-medium">{charge.customer?.name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {charge.customer?.phone ? phoneMaskFull(charge.customer.phone) : charge.customer?.email ?? "Sem contato"}
                        </p>
                      </td>
                      <td className="max-w-56 px-4 py-3">
                        <p className="truncate">{charge.description}</p>
                        {charge.installmentLabel && (
                          <p className="text-xs text-muted-foreground">Parcela {charge.installmentLabel}</p>
                        )}
                        {renderSeriesSummary(charge)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{renderAmount(charge)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p>{formatDate(charge.dueDate)}</p>
                        {dueHint && (
                          <p className={cn("text-xs", charge.status === "OVERDUE" ? "text-destructive" : "text-muted-foreground")}>
                            {dueHint}
                          </p>
                        )}
                      </td>
                      <td className="max-w-64 px-4 py-3">{renderDelivery(charge)}</td>
                      <td className="px-4 py-3 text-center">{renderStatus(charge)}</td>
                      <td className="px-2 py-3 text-right">{renderRowActions(charge)}</td>
                    </tr>
                    {charge.group && expandedRowKeys.has(charge.rowKey) && (
                      <tr className="border-b border-border/30 bg-muted/10">
                        <td colSpan={7} className="px-4 py-3">{renderSeriesInstallments(charge)}</td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentPagination
        page={page}
        total={total}
        perPage={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="cobrança"
        isLoading={isLoading}
      />

      <PayEntryDialog entry={payEntry} onClose={() => setPayEntry(null)} />
      <ChargeLinkDialog
        entryId={linkEntry?.id ?? null}
        entryName={linkEntry?.name}
        onClose={() => setLinkEntry(null)}
      />
      <DunningHistoryDrawer
        entryId={historyEntry?.id ?? null}
        entryName={historyEntry?.name ?? null}
        onClose={() => setHistoryEntry(null)}
      />
      <ChargePauseDialog entry={pauseEntry} onClose={() => setPauseEntry(null)} />
      <ConfirmDeleteDialog
        isOpen={cancelEntry !== null}
        title="Cancelar cobrança"
        description={`Cancelar "${cancelEntry?.name ?? ""}"? Os avisos param. Dá para reabrir depois.`}
        isPending={cancelCharge.isPending}
        confirmLabel="Cancelar cobrança"
        onConfirm={handleCancel}
        onClose={() => setCancelEntry(null)}
      />
      <Sheet open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="sticky top-0 z-10 border-b bg-background px-6 pb-4 pt-6">
            <SheetTitle>Réguas e mensagens</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Quando cada aviso sai, por qual canal e o texto que o cliente recebe. Mudanças valem para os
              próximos envios, inclusive das cobranças que já existem.
            </p>
          </SheetHeader>
          <div className="px-6 py-5">
            <DunningRulesTab />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
