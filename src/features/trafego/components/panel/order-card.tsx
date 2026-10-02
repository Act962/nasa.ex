import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoOrderStatus,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { orderNeedsClientAction } from "@/features/trafego/lib/order-filters";
import { OrderStatusBadge } from "./order-status-badge";

export interface OrderCardData {
  id: string;
  code: string;
  status: TrafegoOrderStatus;
  planNameSnapshot: string;
  platform: TrafegoPlatform;
  campaignType: TrafegoCampaignType;
  objective: TrafegoObjective;
  totalBrlCents: number;
  adBudgetBrlCents: number;
  creativesCount: number;
  maxCreatives: number;
  copiesCount: number;
  maxCopies: number;
  durationDays: number;
}

export function OrderCard({
  order,
  href,
}: {
  order: OrderCardData;
  href: string;
}) {
  const needsClientAction = orderNeedsClientAction(order.status);

  return (
    <Link
      href={href}
      className="group block rounded-[20px] border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {order.code}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1.5 truncate font-semibold">
            {order.planNameSnapshot}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {PLATFORM_SHORT_LABEL[order.platform]} ·{" "}
            {CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]} ·{" "}
            {OBJECTIVE_LABEL[order.objective]}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">
            {formatBrlFromCents(order.totalBrlCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBrlFromCents(order.adBudgetBrlCents)} no anúncio
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="scroll-hidden-x flex min-w-0 flex-1 gap-1.5">
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1">
            {order.creativesCount}/{order.maxCreatives} imagens e vídeos
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1">
            {order.copiesCount}/{order.maxCopies} textos
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1">
            {order.durationDays} dias
          </span>
        </div>
        {needsClientAction ? (
          <span className="shrink-0 font-medium text-warning">Continuar</span>
        ) : null}
        <ChevronRight className="size-4 shrink-0 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
