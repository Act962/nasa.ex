"use client";

import { useState } from "react";
import { Activity, BarChart3, Building2, Headphones, MegaphoneIcon, MoreHorizontal, Rocket } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useTrafegoOrder } from "@/features/trafego/hooks/use-trafego-orders";
import { useTrafegoOrderBudget } from "@/features/trafego/hooks/use-trafego-performance";
import { useCampaignBuilderAccess } from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { isOrderBeforeLaunch, isOrderEditable } from "@/features/trafego/lib/order-status";
import { usePanelPath } from "@/features/trafego/lib/base-path";
import { SupportWhatsappFab } from "./support-whatsapp-fab";
import { OrderDetailHeader } from "./order-detail-header";
import { OrderReviewStatus } from "./approval/order-review-status";
import { resolveSingleAdset, useOrderCardAds } from "./order-card-live-summary";
import { QualityScoreBadge } from "./quality/quality-score-badge";
import { LegacyPerformanceView } from "./performance-view";
import { CampaignOverview } from "./campaign-overview/campaign-overview";
import { SetupInProgressCard } from "./campaign-overview/setup-in-progress-card";
import { OrderCreativeCard } from "./creative-review/order-creative-card";
import { ORDER_PANEL_SECTION, OrderPanelSheet, type OrderPanelSection } from "./order-panel-sheet";

/**
 * Detalhe do pedido sem abas (spec 0126, RF-1..RF-6): a campanha de cara e o resto
 * numa gaveta. Antes de a conta Meta estar conectada, um aviso só e o criativo.
 */
export function TrafegoOrderDetail({ orderId }: { orderId: string }) {
  const [openSection, setOpenSection] = useState<OrderPanelSection | null>(null);
  const { data: order, isLoading } = useTrafegoOrder(orderId);
  const { data: budgetResult, isLoading: isBudgetLoading } = useTrafegoOrderBudget(orderId);
  const { data: builderAccess } = useCampaignBuilderAccess(orderId);
  // Mesma leitura do cartão da lista (cacheada): conjunto único vira o título (spec 0126).
  const liveAds = useOrderCardAds(orderId, Boolean(order && order.platform === "META_ADS"));
  const singleAdset = liveAds ? resolveSingleAdset(liveAds.ads) : null;
  const panelPath = usePanelPath();

  useRegisterOrbitDock({
    leftItems: [
      { label: "Campanhas", href: panelPath, icon: <MegaphoneIcon /> },
      { label: "Andamento", icon: <Activity />, onSelect: () => setOpenSection("andamento") },
    ],
    rightItems: [
      { label: "Empresa", icon: <Building2 />, onSelect: () => setOpenSection("empresa") },
      { label: "Suporte", icon: <Headphones />, onSelect: () => setOpenSection("suporte") },
    ],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Carregando campanha…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-[22px] border border-dashed px-6 py-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            <MegaphoneIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">Campanha não encontrada</p>
          <p className="mt-1 text-xs text-muted-foreground">Volte para a lista e escolha outra campanha.</p>
        </div>
      </div>
    );
  }

  const isAccountConnected = budgetResult?.mode === "account" || budgetResult?.mode === "unavailable";
  // WhatsApp Oficial e pedidos antigos pela conta da agência seguem a leitura antiga.
  const hasLegacyCampaign =
    budgetResult?.mode === "legacy" && (order.platform !== "META_ADS" || Boolean(order.metaCampaignExternalId));
  const canPublish = builderAccess?.isVisible === true;
  const openSupport = () => setOpenSection("suporte");

  const menuSections: OrderPanelSection[] = [
    ...(budgetResult?.mode === "account" ? (["numeros"] as const) : []),
    "andamento",
    "empresa",
    "suporte",
  ];

  // Recomendação da equipe esperando o cliente (spec 0130, RF-8): a mais recente ainda aberta.
  const pendingApproval =
    order.events.findLast((event) => event.requiresApproval && !event.approvedAt && !event.supersededAt) ?? null;
  // Avaliação do Claude liberada pelo cliente (spec 0132, RF-4): a última recomendação está aprovada.
  const isReleased = Boolean(order.events.findLast((event) => event.requiresApproval && !event.supersededAt)?.approvedAt);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6 max-lg:pb-40 md:px-6 md:pt-6">
      <OrderDetailHeader
        order={order}
        listHref={panelPath}
        adsetName={singleAdset?.name ?? null}
        titleBadge={
          singleAdset && liveAds?.isQualityScoreVisible ? (
            <QualityScoreBadge quality={liveAds.adsets.find((adset) => adset.id === singleAdset.id)?.quality ?? null} />
          ) : null
        }
        actions={
          <div className="flex items-center gap-2">
            {canPublish && (
              <Button
                className="h-10 rounded-full"
                onClick={() => setOpenSection("publicar")}
                data-guide={GUIDE_ANCHORS.trafegoPublishTab.id}
              >
                <Rocket className="size-4" />
                Publicar e editar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-10 rounded-full" aria-label="Mais opções">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menuSections.map((section) => (
                  <DropdownMenuItem key={section} onSelect={() => setOpenSection(section)}>
                    {section === "numeros" && <BarChart3 className="size-4" />}
                    {section === "andamento" && <Activity className="size-4" />}
                    {section === "empresa" && <Building2 className="size-4" />}
                    {section === "suporte" && <Headphones className="size-4" />}
                    {ORDER_PANEL_SECTION[section].title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <OrderReviewStatus order={order} pendingApproval={pendingApproval} isReleased={isReleased} onReply={openSupport} />
        {isBudgetLoading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <OrbitaSpinner className="size-4" />
            Lendo a conta de anúncios…
          </div>
        ) : isAccountConnected ? (
          <CampaignOverview orderId={order.id} orderCode={order.code} onSupport={openSupport} />
        ) : hasLegacyCampaign ? (
          <LegacyPerformanceView orderId={order.id} />
        ) : (
          <SetupInProgressCard onSupport={openSupport} />
        )}

        {isOrderBeforeLaunch(order.status) && (
          <OrderCreativeCard
            orderId={order.id}
            creatives={order.creatives}
            isReadOnly={!isOrderEditable(order.status)}
            isLinkEnabled={budgetResult?.mode === "account"}
          />
        )}
      </div>

      <OrderPanelSheet
        section={openSection}
        onClose={() => setOpenSection(null)}
        isReadOnly={!isOrderEditable(order.status)}
        order={{
          id: order.id,
          code: order.code,
          status: order.status,
          durationDays: order.durationDays,
          events: order.events,
          briefing: {
            businessName: order.businessName,
            businessNiche: order.businessNiche,
            targetAudience: order.targetAudience,
            destinationUrl: order.destinationUrl,
            whatsappNumber: order.whatsappNumber,
            notes: order.notes,
          },
        }}
      />

      <SupportWhatsappFab orderCode={order.code} />
    </div>
  );
}
