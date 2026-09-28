"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import {
  useActivateTrafegoOrder,
  useTrafegoOrder,
} from "@/features/trafego/hooks/use-trafego-orders";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import {
  isOrderActivatable,
  isOrderEditable,
} from "@/features/trafego/lib/order-status";
import { usePanelPath } from "@/features/trafego/lib/base-path";
import { OrderStatusBadge } from "./order-status-badge";
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
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando campanha…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 py-20 text-center text-sm text-muted-foreground">
        Campanha não encontrada.
      </div>
    );
  }

  const readOnly = !isOrderEditable(order.status);
  const campaignTypeTerm: TechnicalTermKey =
    order.campaignType === "PROSPECCAO"
      ? "prospecting"
      : order.campaignType === "REMARKETING"
        ? "remarketing"
        : "campaign";
  const objectiveTerm: TechnicalTermKey =
    order.objective === "LEADS" ? "lead" : "optimization";
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
      "envie pelo menos um criativo ou informe seu perfil",
    selectedCopies === 0 && "selecione pelo menos uma copy",
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
              : "Campanha enviada! Nossa equipe assume a partir daqui 🚀",
          );
          setTab("andamento");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <Link
        href={panelPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Minhas campanhas
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {order.code}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <h1 className="mt-1.5 text-xl font-semibold">
            {order.planNameSnapshot}
          </h1>
          <p className="text-sm text-muted-foreground">
            {PLATFORM_SHORT_LABEL[order.platform]}
            <TechnicalTerm term="paidTraffic" /> ·{" "}
            {CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]}
            <TechnicalTerm term={campaignTypeTerm} /> ·{" "}
            {OBJECTIVE_LABEL[order.objective]}
            <TechnicalTerm term={objectiveTerm} /> · {order.durationDays} dias
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">
            {formatBrlFromCents(order.totalBrlCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBrlFromCents(order.adBudgetBrlCents)} de verba +{" "}
            {formatBrlFromCents(order.serviceFeeBrlCents)} de serviço
          </p>
        </div>
      </div>

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

        {isOrderActivatable(order.status) && (
          <div className="mt-5 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {canActivate
                    ? "Tudo pronto para a equipe assumir"
                    : "Falta pouco para ativar"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {canActivate
                    ? "Ao ativar, sua campanha entra na fila da nossa equipe."
                    : `Para ativar: ${pendingReasons.join(", ")}.`}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleActivate}
                disabled={!canActivate || activateOrder.isPending}
              >
                {activateOrder.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Rocket className="mr-1.5 size-4" />
                )}
                Ativar campanha
              </Button>
            </div>
          </div>
        )}

        {order.status === "ACCOUNT_REVIEW" && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-500" />
            <div>
              <p className="text-sm font-medium">
                Estamos analisando sua conta de anúncios
                <TechnicalTerm term="adAccount" />
              </p>
              <p className="text-xs text-muted-foreground">
                Se você já tem BM
                <TechnicalTerm term="bm" />, adicione a Órbita como parceira —
                enviamos o passo a passo por WhatsApp e e-mail. Enquanto isso,
                suba os criativos
                <TechnicalTerm term="creative" /> e a copy
                <TechnicalTerm term="copy" />: quando a conta for liberada, é só
                ativar.
              </p>
            </div>
          </div>
        )}

        {order.status === "REQUESTED" && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-500" />
            <div>
              <p className="text-sm font-medium">Recebemos sua campanha</p>
              <p className="text-xs text-muted-foreground">
                Nossa equipe está revisando os materiais. Você é avisado por
                aqui a cada mudança.
              </p>
            </div>
          </div>
        )}

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
