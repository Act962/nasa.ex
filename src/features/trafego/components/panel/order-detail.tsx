"use client";

import { useState } from "react";
import { Activity, BarChart3, FolderOpen, MegaphoneIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { toast } from "sonner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  useActivateTrafegoOrder,
  useTrafegoOrder,
} from "@/features/trafego/hooks/use-trafego-orders";
import {
  isOrderActivatable,
  isOrderEditable,
} from "@/features/trafego/lib/order-status";
import { usePanelPath } from "@/features/trafego/lib/base-path";
import { StatusTimeline } from "./status-timeline";
import { CreativesManager } from "./creatives-manager";
import { CopiesManager } from "./copies-manager";
import { BriefingForm } from "./briefing-form";
import { PerformanceView } from "./performance-view";
import { SupportThread } from "./support-thread";
import { SupportWhatsappFab } from "./support-whatsapp-fab";
import { NextStepsCard } from "./next-steps-card";
import { ReleaseEditor } from "./release-editor";
import { AccessChecklist } from "./access-checklist";
import { CampaignLaunchProgress } from "./campaign-launch-progress";
import { AdPreviewMockup } from "./ad-preview-mockup";
import { OrderDetailHeader } from "./order-detail-header";
import { OrderStatusNotices } from "./order-status-notices";
import {
  CampaignSectionNav,
  type CampaignSection,
} from "./campaign-section-nav";

const ACCESS_READY_STATUSES = new Set<TrafegoOrderStatus>([
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

const TEAM_PROGRESS_STATUSES = new Set<TrafegoOrderStatus>([
  "REQUESTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

const PERFORMANCE_READY_STATUSES = new Set<TrafegoOrderStatus>([
  "RUNNING",
  "PAUSED",
  "COMPLETED",
]);

const REQUIRED_SECTIONS: CampaignSection[] = [
  "materiais",
  "release",
  "acessos",
  "andamento",
  "desempenho",
];

export function TrafegoOrderDetail({ orderId }: { orderId: string }) {
  const [tab, setTab] = useState<CampaignSection>("materiais");
  const { data: order, isLoading } = useTrafegoOrder(orderId);
  const panelPath = usePanelPath();
  const activateOrder = useActivateTrafegoOrder();

  useRegisterOrbitDock({
    leftItems: [
      { label: "Campanhas", href: panelPath, icon: <MegaphoneIcon /> },
      {
        label: "Materiais",
        icon: <FolderOpen />,
        onSelect: () => setTab("materiais"),
        isActive: tab === "materiais",
      },
    ],
    rightItems: [
      {
        label: "Andamento",
        icon: <Activity />,
        onSelect: () => setTab("andamento"),
        isActive: tab === "andamento",
      },
      {
        label: "Desempenho",
        icon: <BarChart3 />,
        onSelect: () => setTab("desempenho"),
        isActive: tab === "desempenho",
      },
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
          <p className="mt-1 text-xs text-muted-foreground">
            Volte para a lista e escolha outra campanha.
          </p>
        </div>
      </div>
    );
  }

  const readOnly = !isOrderEditable(order.status);
  const selectedCopies = order.copies.filter((copy) => copy.isSelected).length;
  const previewCopy = order.copies.find((copy) => copy.isSelected) ?? null;
  const previewCreative =
    order.creatives.find((creative) => creative.status === "SELECTED") ??
    order.creatives[0] ??
    null;
  const hasDestination = Boolean(order.destinationUrl || order.whatsappNumber);
  const hasMaterials =
    order.creatives.length > 0 || Boolean(order.materialsProfileLink);
  const canActivate =
    isOrderActivatable(order.status) &&
    hasMaterials &&
    selectedCopies > 0 &&
    hasDestination;
  const sectionCompletion: Partial<Record<CampaignSection, boolean>> = {
    materiais: hasMaterials && selectedCopies > 0 && hasDestination,
    release: Boolean(order.releaseSavedAt),
    acessos: ACCESS_READY_STATUSES.has(order.status),
    andamento: TEAM_PROGRESS_STATUSES.has(order.status),
    desempenho: PERFORMANCE_READY_STATUSES.has(order.status),
  };
  const nextIncomplete =
    REQUIRED_SECTIONS.find((section) => !sectionCompletion[section]) ?? null;

  const pendingReasons = [
    order.creatives.length === 0 &&
      !order.materialsProfileLink &&
      "envie pelo menos uma imagem ou vídeo, ou informe seu perfil",
    selectedCopies === 0 && "selecione pelo menos um texto do anúncio",
    !hasDestination && "informe o site de destino ou o WhatsApp",
  ].filter(Boolean) as string[];

  function handleActivate() {
    activateOrder.mutate(
      { orderId },
      {
        onSuccess: (result) => {
          toast.success(
            result.alreadyRequested
              ? "Esta campanha já estava com a equipe."
              : "Campanha enviada! Nossa equipe assume a partir daqui.",
          );
          setTab("andamento");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6 max-lg:pb-40 md:px-6 md:pt-6">
      <OrderDetailHeader
        order={order}
        activeSection={tab}
        listHref={panelPath}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as CampaignSection)}
        className="mt-5"
      >
        <CampaignLaunchProgress
          status={order.status}
          hasMaterials={hasMaterials}
          hasSelectedCopy={selectedCopies > 0}
          hasDestination={hasDestination}
          hasRelease={Boolean(order.releaseSavedAt)}
        />
        <CampaignSectionNav
          completion={sectionCompletion}
          nextIncomplete={nextIncomplete}
        />

        <OrderStatusNotices
          status={order.status}
          canActivate={canActivate}
          pendingReasons={pendingReasons}
          isActivating={activateOrder.isPending}
          onActivate={handleActivate}
        />

        {/* Antes das abas: o cliente acabou de entrar e precisa saber o que fazer. */}
        <div className="mt-6">
          <NextStepsCard orderId={order.id} />
        </div>

        <TabsContent value="materiais" className="mt-6 space-y-8">
          <CreativesManager
            orderId={order.id}
            creatives={order.creatives}
            maxCreatives={order.maxCreatives}
            materialsProfileLink={order.materialsProfileLink}
            readOnly={readOnly}
          />
          <CopiesManager
            orderId={order.id}
            copies={order.copies}
            maxCopies={order.maxCopies}
            readOnly={readOnly}
          />
          <AdPreviewMockup
            platform={order.platform}
            businessName={order.businessName}
            destinationUrl={order.destinationUrl}
            whatsappNumber={order.whatsappNumber}
            copy={previewCopy}
            creative={previewCreative}
          />
          <BriefingForm
            orderId={order.id}
            readOnly={readOnly}
            initial={{
              businessName: order.businessName,
              businessNiche: order.businessNiche,
              targetAudience: order.targetAudience,
              destinationUrl: order.destinationUrl,
              whatsappNumber: order.whatsappNumber,
              notes: order.notes,
            }}
          />
        </TabsContent>

        <TabsContent value="release" className="mt-6">
          <ReleaseEditor orderId={order.id} />
        </TabsContent>

        <TabsContent value="acessos" className="mt-6">
          <AccessChecklist orderId={order.id} />
        </TabsContent>

        <TabsContent value="andamento" className="mt-6">
          <StatusTimeline status={order.status} events={order.events} />
        </TabsContent>

        <TabsContent value="desempenho" className="mt-6">
          <PerformanceView orderId={order.id} />
        </TabsContent>

        <TabsContent value="suporte" className="mt-6">
          <SupportThread orderId={order.id} />
        </TabsContent>
      </Tabs>

      <SupportWhatsappFab orderCode={order.code} />
    </div>
  );
}
