"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoOrderStatus,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { CAMPAIGN_TYPE_SHORT_LABEL, PLATFORM_SHORT_LABEL } from "@/features/trafego/lib/catalog-labels";
import { buildOrderTitle } from "@/features/trafego/lib/order-display";
import { OrderStatusBadge } from "./order-status-badge";
import { PanelPageHeader } from "./panel-page-header";

interface OrderDetailHeaderProps {
  order: {
    code: string;
    status: TrafegoOrderStatus;
    planNameSnapshot: string;
    businessName: string | null;
    platform: TrafegoPlatform;
    campaignType: TrafegoCampaignType;
    objective: TrafegoObjective;
    durationDays: number;
  };
  listHref: string;
  actions?: ReactNode;
  /** Conjunto único da campanha (spec 0126): vira o título, igual ao cartão da lista. */
  adsetName?: string | null;
  titleBadge?: ReactNode;
}

/** Cabeçalho do pedido: código, estado em linguagem simples e as ações (spec 0126, RF-1). */
export function OrderDetailHeader({ order, listHref, actions, adsetName, titleBadge }: OrderDetailHeaderProps) {
  const orderTitle = buildOrderTitle(order);
  const details = `${PLATFORM_SHORT_LABEL[order.platform]} · ${CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]} · ${order.durationDays} dias`;
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
            <span className="font-mono text-xs text-muted-foreground">{order.code}</span>
            <OrderStatusBadge status={order.status} isClientView />
            {titleBadge}
          </>
        }
        title={adsetName ?? orderTitle}
        subtitle={adsetName ? `${orderTitle} · ${details}` : details}
        actions={actions}
      />
    </>
  );
}
