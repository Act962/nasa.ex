"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Eye, Inbox, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useIgnorePaymentInboxItem,
  usePaymentInboxConfig,
  usePaymentInboxItems,
  useSyncPaymentInboxNow,
  useUpdatePaymentInboxConfig,
  type PaymentInboxStatus,
} from "../../hooks/use-payment-inbox";
import { attachmentPreviewUrl } from "../../hooks/use-payment-attachments";
import { describePaymentError } from "../../lib/describe-error";
import {
  formatCurrency,
  formatDate,
  formatRelativeDateTime,
  formatTimestampDate,
} from "../../lib/format";

type StatusFilter = PaymentInboxStatus | "all";

const STATUS_LABELS: Record<PaymentInboxStatus, string> = {
  NEW: "Na fila",
  PROPOSED: "Pronto pra lançar",
  ACCEPTED: "Lançado",
  IGNORED: "Ignorado",
  FAILED: "Falhou",
};

const STATUS_BADGE_CLASSES: Record<PaymentInboxStatus, string> = {
  NEW: "border-border bg-muted text-muted-foreground",
  PROPOSED: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ACCEPTED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  IGNORED: "border-border bg-muted text-muted-foreground",
  FAILED: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

interface ExtractionPreview {
  amountCents?: number | null;
  dueDate?: string | null;
  issuerName?: string | null;
}

function readExtractionPreview(value: unknown): ExtractionPreview | null {
  return typeof value === "object" && value !== null ? (value as ExtractionPreview) : null;
}

export function InboxSection() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PROPOSED");
  const { data: overview, isLoading: isOverviewLoading } = usePaymentInboxConfig();
  const { data: itemsData, isLoading: isItemsLoading } = usePaymentInboxItems({
    statuses: statusFilter === "all" ? undefined : [statusFilter],
    perPage: 30,
  });
  const updateConfig = useUpdatePaymentInboxConfig();
  const syncNow = useSyncPaymentInboxNow();
  const ignoreItem = useIgnorePaymentInboxItem();

  const isConnected = overview?.integration.isConnected ?? false;
  const hasGmailScope = overview?.integration.hasGmailScope ?? false;
  const isEnabled = overview?.config.isEnabled ?? false;

  function handleToggle(nextEnabled: boolean) {
    updateConfig.mutate(
      { isEnabled: nextEnabled },
      {
        onSuccess: () => toast.success(nextEnabled ? "Caixa de entrada ativada" : "Caixa de entrada desativada"),
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível salvar")),
      },
    );
  }

  function handleSync() {
    syncNow.mutate(
      {},
      {
        onSuccess: () => toast.success("Leitura do e-mail iniciada. Os documentos aparecem em alguns minutos."),
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível sincronizar")),
      },
    );
  }

  function handleIgnore(itemId: string) {
    ignoreItem.mutate(
      { id: itemId },
      {
        onSuccess: () => toast.success("Documento ignorado"),
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível ignorar")),
      },
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Inbox className="size-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Caixa de entrada (Gmail)</h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              A cada 30 minutos lê os anexos em PDF da caixa Google conectada
              {overview?.integration.accountEmail ? ` (${overview.integration.accountEmail})` : ""} — a
              caixa de quem conectou a integração. Cada documento novo lido custa 5★.
            </p>
            {overview?.config.lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                Última leitura {formatRelativeDateTime(overview.config.lastSyncAt)}
              </p>
            )}
            {overview?.config.lastError && (
              <p className="text-xs text-red-600 dark:text-red-400">{overview.config.lastError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="payment-inbox-enabled"
              checked={isEnabled}
              disabled={isOverviewLoading || updateConfig.isPending || !isConnected}
              onCheckedChange={handleToggle}
            />
            <Label htmlFor="payment-inbox-enabled" className="text-xs">
              Ativa
            </Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={!isEnabled || !hasGmailScope || syncNow.isPending}
          >
            {syncNow.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {!isOverviewLoading && (!isConnected || !hasGmailScope) && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          {isConnected
            ? "A integração Google não tem permissão de leitura do Gmail. "
            : "Nenhuma conta Google conectada. "}
          <Link href="/integrations" className="underline">
            Conectar em Integrações
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.keys(STATUS_LABELS) as PaymentInboxStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
                {overview ? ` (${overview.countsByStatus[status]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{itemsData?.total ?? 0} item(ns)</span>
      </div>

      {isItemsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : !itemsData || itemsData.items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nenhum documento neste filtro.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {itemsData.items.map((item) => {
            const preview = readExtractionPreview(item.extraction);
            const status = item.status as PaymentInboxStatus;
            return (
              <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">{item.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.fromName ?? item.fromEmail} · {formatTimestampDate(item.receivedAt)}
                    {preview?.amountCents != null ? ` · ${formatCurrency(preview.amountCents)}` : ""}
                    {preview?.dueDate ? ` · vence ${formatDate(preview.dueDate)}` : ""}
                  </p>
                  {item.entry && (
                    <p className="truncate text-xs text-muted-foreground">Lançamento: {item.entry.description}</p>
                  )}
                  {item.errorMessage && (
                    <p className="truncate text-xs text-red-600 dark:text-red-400">{item.errorMessage}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={cn("text-[11px]", STATUS_BADGE_CLASSES[status])}>
                    {STATUS_LABELS[status]}
                  </Badge>
                  {item.attachment && (
                    <Button asChild size="icon" variant="ghost" className="size-8">
                      <a href={attachmentPreviewUrl(item.attachment.id)} target="_blank" rel="noreferrer">
                        <Eye className="size-4" />
                      </a>
                    </Button>
                  )}
                  {status !== "ACCEPTED" && status !== "IGNORED" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      title="Ignorar"
                      disabled={ignoreItem.isPending}
                      onClick={() => handleIgnore(item.id)}
                    >
                      <Ban className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
