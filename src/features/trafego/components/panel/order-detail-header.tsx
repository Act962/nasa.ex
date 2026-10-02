"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoOrderStatus,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { useTrafegoOrderPerformance } from "@/features/trafego/hooks/use-trafego-orders";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";
import { OrderStatusBadge } from "./order-status-badge";
import { PanelPageHeader } from "./panel-page-header";
import { PanelStatGrid } from "./panel-stat-grid";
import {
  CAMPAIGN_SECTION_LABEL,
  CAMPAIGN_SECTION_SUBTITLE,
  type CampaignSection,
} from "./campaign-section-nav";

interface OrderDetailHeaderProps {
  order: {
    id: string;
    code: string;
    status: TrafegoOrderStatus;
    planNameSnapshot: string;
    platform: TrafegoPlatform;
    campaignType: TrafegoCampaignType;
    objective: TrafegoObjective;
    durationDays: number;
    totalBrlCents: number;
    adBudgetBrlCents: number;
    serviceFeeBrlCents: number;
  };
  activeSection: CampaignSection;
  listHref: string;
}

function campaignTypeTermFor(
  campaignType: TrafegoCampaignType,
): TechnicalTermKey {
  if (campaignType === "PROSPECCAO") return "prospecting";
  if (campaignType === "REMARKETING") return "remarketing";
  return "campaign";
}

export function OrderDetailHeader({
  order,
  activeSection,
  listHref,
}: OrderDetailHeaderProps) {
  const { data: performance } = useTrafegoOrderPerformance(order.id);
  const spentBrlCents = performance?.budget.spentBrlCents ?? 0;
  const objectiveTerm: TechnicalTermKey =
    order.objective === "LEADS" ? "lead" : "optimization";

  return (
    <>
      {/* Abaixo de lg o menu de baixo já tem "Campanhas" para voltar. */}
      <Link
        href={listHref}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground max-lg:hidden"
      >
        <ArrowLeft className="size-4" />
        Minhas campanhas
      </Link>

      <PanelPageHeader
        eyebrow={
          <>
            <span className="font-mono text-xs text-muted-foreground">
              {order.code}
            </span>
            <OrderStatusBadge status={order.status} />
          </>
        }
        title={order.planNameSnapshot}
        mobileTitle={CAMPAIGN_SECTION_LABEL[activeSection]}
        mobileSubtitle={`${order.planNameSnapshot} · ${CAMPAIGN_SECTION_SUBTITLE[activeSection]}`}
        subtitle={
          <>
            {PLATFORM_SHORT_LABEL[order.platform]}
            <TechnicalTerm term="paidTraffic" /> ·{" "}
            {CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]}
            <TechnicalTerm
              term={campaignTypeTermFor(order.campaignType)}
            /> · {OBJECTIVE_LABEL[order.objective]}
            <TechnicalTerm term={objectiveTerm} /> · {order.durationDays} dias
          </>
        }
      />

      <PanelStatGrid
        className="mt-4"
        stats={[
          {
            key: "adBudget",
            label: "Verba do anúncio",
            value: formatBrlFromCents(order.adBudgetBrlCents),
            term: "adBudget",
          },
          {
            key: "spent",
            label: "Já gasto",
            value: formatBrlFromCents(spentBrlCents),
            hint: `Restam ${formatBrlFromCents(Math.max(0, order.adBudgetBrlCents - spentBrlCents))}`,
          },
          {
            key: "serviceFee",
            label: "Taxa de serviço",
            value: formatBrlFromCents(order.serviceFeeBrlCents),
          },
          {
            key: "total",
            label: "Total pago",
            value: formatBrlFromCents(order.totalBrlCents),
          },
        ]}
      />
    </>
  );
}
