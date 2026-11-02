"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pause, Pencil, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import {
  useDiscardCampaignDraft,
  usePublishCampaign,
  useUpdateOrderCampaign,
  type useCampaignBuilderContext,
} from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { CampaignEditPanel } from "./campaign-edit-panel";

/** Uma campanha "deste pedido" com as ações do painel (spec 0124, RF-9, RF-10). */

type BuilderContextData = NonNullable<ReturnType<typeof useCampaignBuilderContext>["data"]>;
export type OrderCampaign = BuilderContextData["campaigns"][number];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "No ar",
  PAUSED: "Pausada",
  CAMPAIGN_PAUSED: "Pausada",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problema",
  PENDING_REVIEW: "Em revisão da Meta",
  DISAPPROVED: "Recusada pela Meta",
};

export function OrderCampaignCard({
  orderId,
  campaign,
  context,
}: {
  orderId: string;
  campaign: OrderCampaign;
  context: BuilderContextData;
}) {
  const publish = usePublishCampaign();
  const discard = useDiscardCampaignDraft();
  const update = useUpdateOrderCampaign();
  const [confirmAction, setConfirmAction] = useState<"publish" | "discard" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const isActive = campaign.status === "ACTIVE";
  const preview = campaign.ads.find((ad) => ad.previewUrl || ad.previewLink);

  function handlePublish() {
    publish.mutate(
      { orderId, campaignId: campaign.id },
      {
        onSuccess: () => {
          toast.success("Campanha publicada. A Meta revisa o anúncio antes de entregar.");
          emitTourResult({ kind: GUIDE_RESULT_KINDS.trafegoCampaignPublished });
          setConfirmAction(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleDiscard() {
    discard.mutate(
      { orderId, campaignId: campaign.id },
      {
        onSuccess: () => {
          toast.success("Rascunho arquivado.");
          setConfirmAction(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <li className="rounded-[18px] border bg-card p-3.5">
      <div className="flex items-start gap-3">
        {preview?.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura do criativo no CDN da Meta
          <img src={preview.previewUrl} alt="" className="size-14 shrink-0 rounded-[12px] object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{campaign.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={isActive ? "default" : "outline"}>
              {STATUS_LABEL[campaign.effectiveStatus ?? campaign.status ?? ""] ?? campaign.effectiveStatus ?? campaign.status}
            </Badge>
            {campaign.lifetimeBudgetCents !== null && <span>Verba {formatBrlFromCents(campaign.lifetimeBudgetCents)}</span>}
            <span>· {campaign.ads.length} anúncio(s)</span>
            {preview?.previewLink && (
              <a href={preview.previewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                Prévia
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!isActive && (
          <Button
            size="sm"
            className="h-8 rounded-full"
            onClick={() => setConfirmAction("publish")}
            data-guide={GUIDE_ANCHORS.trafegoPublishCampaign.id}
          >
            <Rocket className="mr-1 size-3.5" />
            Publicar
          </Button>
        )}
        {isActive && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { orderId, campaignId: campaign.id, change: { action: "pause" } },
                { onSuccess: () => toast.success("Campanha pausada."), onError: (error) => toast.error(error.message) },
              )
            }
          >
            <Pause className="mr-1 size-3.5" />
            Pausar
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setIsEditing((isOn) => !isOn)}>
          <Pencil className="mr-1 size-3.5" />
          {isEditing ? "Fechar edição" : "Editar"}
        </Button>
        {!isActive && (
          <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => setConfirmAction("discard")}>
            <Trash2 className="mr-1 size-3.5" />
            Descartar
          </Button>
        )}
      </div>

      {isEditing && <CampaignEditPanel orderId={orderId} campaign={campaign} context={context} />}

      <ConfirmDialog
        isOpen={confirmAction === "publish"}
        title="Publicar esta campanha?"
        description={`A campanha vai ao ar na sua conta com verba total de ${formatBrlFromCents(campaign.lifetimeBudgetCents ?? 0)}, cobrada pela Meta no seu cartão. A Meta revisa o anúncio antes de entregar.`}
        confirmText="Publicar"
        onConfirm={handlePublish}
        onCancel={() => setConfirmAction(null)}
        isLoading={publish.isPending}
      />
      <ConfirmDialog
        isOpen={confirmAction === "discard"}
        title="Descartar o rascunho?"
        description="A campanha fica arquivada na sua conta. Nada é apagado e nada é gasto."
        confirmText="Descartar"
        onConfirm={handleDiscard}
        onCancel={() => setConfirmAction(null)}
        isDangerous
        isLoading={discard.isPending}
      />
    </li>
  );
}
