"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CatalogOrderStatus,
  ForgeContractStatus,
  ForgeProposalStatus,
} from "@/generated/prisma/enums";
import {
  CalendarIcon,
  FileSignature,
  ImageIcon,
  Loader2,
  ReceiptIcon,
  ShoppingBasket,
  WalletIcon,
} from "lucide-react";
import { useLeadProducts } from "../hooks/use-lead-products";

type PurchaseItem = {
  name: string;
  quantity: number;
  unitValue: number;
  discount: number;
  total: number;
  imageUrl: string | null;
};

type Purchase = {
  key: string;
  origin: "catalog" | "forge";
  title: string;
  date: string;
  total: number;
  statusLabel: string;
  statusClassName: string;
  items: PurchaseItem[];
};

const CATALOG_STATUS_STYLE: Record<
  CatalogOrderStatus,
  { label: string; className: string }
> = {
  RECEIVED: {
    label: "Recebido",
    className: "text-slate-500 border-slate-500/30 bg-slate-500/10",
  },
  NEGOTIATING: {
    label: "Em negociação",
    className: "text-sky-500 border-sky-500/30 bg-sky-500/10",
  },
  AWAITING_PAYMENT: {
    label: "Aguardando pagamento",
    className: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  },
  PAID: {
    label: "Pago",
    className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  },
  IN_LOGISTICS: {
    label: "Em logística",
    className: "text-violet-500 border-violet-500/30 bg-violet-500/10",
  },
  DELIVERED: {
    label: "Entregue",
    className: "text-emerald-600 border-emerald-600/30 bg-emerald-600/10",
  },
  CANCELED: {
    label: "Cancelado",
    className: "text-red-500 border-red-500/30 bg-red-500/10",
  },
};

const FORGE_PAID_STYLE = {
  label: "Paga",
  className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
};

const FORGE_ACTIVE_CONTRACT_STYLE = {
  label: "Contrato ativo",
  className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
};

const FORGE_PROPOSAL_STATUS_LABEL: Record<ForgeProposalStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISUALIZADA: "Visualizada",
  PAGA: "Paga",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

function toForgeStatusStyle(
  status: ForgeProposalStatus,
  contractStatus: ForgeContractStatus | null,
) {
  if (contractStatus === "ATIVO") return FORGE_ACTIVE_CONTRACT_STYLE;
  if (status === "PAGA") return FORGE_PAID_STYLE;
  return {
    label: FORGE_PROPOSAL_STATUS_LABEL[status],
    className: "text-muted-foreground border-border bg-muted/30",
  };
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

interface LeadProductsProps {
  leadId: string;
  starFriendsSlot?: ReactNode;
}

export function LeadProducts({ leadId, starFriendsSlot }: LeadProductsProps) {
  const { data, isLoading } = useLeadProducts(leadId);

  const purchases: Purchase[] = [
    ...(data?.catalogOrders ?? []).map((order) => ({
      key: `catalog-${order.id}`,
      origin: "catalog" as const,
      title: `Pedido #${order.saleNumber}`,
      date: order.paidAt ?? order.createdAt,
      total: order.total,
      statusLabel: CATALOG_STATUS_STYLE[order.status].label,
      statusClassName: CATALOG_STATUS_STYLE[order.status].className,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitValue: item.unitPrice,
        discount: 0,
        total: item.total,
        imageUrl: item.imageUrl,
      })),
    })),
    ...(data?.forge ?? []).map((proposal) => {
      const statusStyle = toForgeStatusStyle(
        proposal.status,
        proposal.contractStatus,
      );
      return {
        key: `forge-${proposal.proposalId}`,
        origin: "forge" as const,
        title: `Proposta #${proposal.number} — ${proposal.title}`,
        date: proposal.purchasedAt,
        total: proposal.total,
        statusLabel: statusStyle.label,
        statusClassName: statusStyle.className,
        items: proposal.items,
      };
    }),
  ].sort((first, second) => second.date.localeCompare(first.date));

  const totals = data?.totals;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto py-4">
      {/* Slot STAR FRIENDS */}
      {starFriendsSlot}

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          icon={<ReceiptIcon className="size-4" />}
          label="Compras"
          value={String(totals?.purchasesCount ?? 0)}
        />
        <SummaryCard
          icon={<WalletIcon className="size-4" />}
          label="Total gasto"
          value={formatCurrency(totals?.totalSpent ?? 0)}
          valueClassName="text-emerald-500"
        />
        <SummaryCard
          icon={<CalendarIcon className="size-4" />}
          label="Última compra"
          value={
            totals?.lastPurchaseAt ? formatDate(totals.lastPurchaseAt) : "—"
          }
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : purchases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 py-10 text-center text-xs text-muted-foreground">
          <ShoppingBasket className="size-6" />
          Este lead ainda não tem pedidos nem serviços contratados.
        </div>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-border/60 pl-4">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.key} purchase={purchase} />
          ))}
        </ol>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/50 p-3">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn("truncate text-base font-bold tabular-nums", valueClassName)}
      >
        {value}
      </span>
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const isCatalog = purchase.origin === "catalog";

  return (
    <li className="relative rounded-xl border border-border/50 p-3">
      <span className="absolute top-4 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                isCatalog
                  ? "text-emerald-500 border-emerald-500/30"
                  : "text-[#1E90FF] border-[#1E90FF]/30",
              )}
            >
              {isCatalog ? (
                <ShoppingBasket className="size-3" />
              ) : (
                <FileSignature className="size-3" />
              )}
              {isCatalog ? "Catálogo online" : "Forge"}
            </Badge>
            <Badge variant="outline" className={purchase.statusClassName}>
              {purchase.statusLabel}
            </Badge>
          </div>
          <p className="truncate text-sm font-medium">{purchase.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(purchase.date)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-500">
          {formatCurrency(purchase.total)}
        </p>
      </div>

      {purchase.items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {purchase.items.map((item, index) => (
            <li
              key={`${purchase.key}-${index}`}
              className="flex items-center gap-3"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="size-10 shrink-0 rounded-md border border-border/50 object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/30 text-muted-foreground">
                  <ImageIcon className="size-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{item.name}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {item.quantity} × {formatCurrency(item.unitValue)}
                  {item.discount > 0 &&
                    ` · desconto ${formatCurrency(item.discount)}`}
                </p>
              </div>
              <p className="shrink-0 text-xs font-medium tabular-nums">
                {formatCurrency(item.total)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
