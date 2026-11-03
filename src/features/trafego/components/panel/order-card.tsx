"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoOrderStatus,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { CAMPAIGN_TYPE_SHORT_LABEL, PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { buildOrderTitle } from "@/features/trafego/lib/order-display";
import { orderNeedsClientAction } from "@/features/trafego/lib/order-filters";
import { OrderStatusBadge } from "./order-status-badge";
import { PendingApprovalBadge } from "./approval/pending-approval-badge";
import {
  OrderCardAdRows,
  OrderCardAdsProblem,
  OrderCardCampaignsCount,
  useOrderCardAdsProblem,
  resolveSingleAdset,
  useOrderCardAds,
} from "./order-card-live-summary";
import { QualityScoreBadge } from "./quality/quality-score-badge";
import { useCampaignBuilderAccess } from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { phoneMaskFull } from "@/utils/format-phone";

export interface OrderCardData {
  id: string;
  code: string;
  status: TrafegoOrderStatus;
  planNameSnapshot: string;
  businessName?: string | null;
  whatsappNumber?: string | null;
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
  /** Recomendação da equipe esperando aprovação (spec 0130, RF-8). */
  hasPendingApproval?: boolean;
}

export function OrderCard({
  order,
  href,
}: {
  order: OrderCardData;
  href: string;
}) {
  const needsClientAction = orderNeedsClientAction(order.status);
  // Só lê a Meta para campanha no ar ou pausada (spec 0126).
  const hasLiveSummary = order.platform === "META_ADS" && (order.status === "RUNNING" || order.status === "PAUSED");
  const live = useOrderCardAds(order.id, hasLiveSummary);
  const liveProblem = useOrderCardAdsProblem(order.id, hasLiveSummary);
  const { data: builderAccess } = useCampaignBuilderAccess(order.id, { enabled: hasLiveSummary });
  // canBuild: dono/admin E conexão que pode alterar a conta (isVisible só diz "mostrar a aba").
  const canEdit = builderAccess?.canBuild === true;
  const singleAdset = live ? resolveSingleAdset(live.ads) : null;
  const orderTitle = buildOrderTitle(order);

  return (
    // Link "esticado" por trás do cartão: os liga/desliga ficam por cima e não navegam.
    <div className="group relative rounded-[20px] border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
      <Link href={href} className="absolute inset-0 rounded-[20px]" aria-label={`Abrir ${orderTitle}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {singleAdset && <p className="text-sm font-medium">Conjunto</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{order.code}</span>
            <OrderStatusBadge status={order.status} isClientView />
            {order.hasPendingApproval && <PendingApprovalBadge />}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="line-clamp-2 font-semibold">{singleAdset ? singleAdset.name : orderTitle}</p>
                {singleAdset && live?.isQualityScoreVisible && (
                  <QualityScoreBadge quality={live.adsets.find((adset) => adset.id === singleAdset.id)?.quality ?? null} />
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {singleAdset ? `${orderTitle} · ` : ""}
                {PLATFORM_SHORT_LABEL[order.platform]} · {CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]} ·{" "}
                {order.durationDays} dias
                {order.whatsappNumber && (
                  <span className="ml-2 font-medium text-success tabular-nums">{phoneMaskFull(order.whatsappNumber)}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">{formatBrlFromCents(order.adBudgetBrlCents)}</p>
          <p className="text-xs text-muted-foreground">verba</p>
          {live && <OrderCardCampaignsCount campaignsCount={live.campaignsCount} />}
        </div>
      </div>

      {live && <OrderCardAdRows
          orderId={order.id}
          ads={live.ads}
          currency={live.currency}
          canEdit={canEdit}
          isQualityScoreVisible={live.isQualityScoreVisible}
        />}
      {liveProblem && <OrderCardAdsProblem message={liveProblem} />}

      {needsClientAction && (
        <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-warning">
          Continuar
          <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  );
}
