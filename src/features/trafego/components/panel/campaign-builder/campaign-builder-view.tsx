"use client";

import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import {
  useCampaignBuilderAccess,
  useCampaignBuilderContext,
} from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { CampaignDraftWizard } from "./campaign-draft-wizard";
import { OrderCampaignCard } from "./order-campaign-card";

/** Aba "Publicar" do painel do pedido (spec 0124, RF-2). */

export function CampaignBuilderView({ orderId, durationDays }: { orderId: string; durationDays: number }) {
  const { data: access, isLoading: isLoadingAccess } = useCampaignBuilderAccess(orderId);
  const canBuild = access?.canBuild === true;
  const { data: context, isLoading: isLoadingContext, error } = useCampaignBuilderContext(orderId, { enabled: canBuild });
  const [isCreating, setIsCreating] = useState(false);

  if (isLoadingAccess || (canBuild && isLoadingContext)) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Lendo a conta de anúncios…
      </div>
    );
  }

  if (!canBuild || !context) {
    return (
      <div className="flex items-start gap-2 rounded-[20px] border border-warning/40 bg-warning/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{access?.message ?? error?.message ?? "Não foi possível abrir a criação de campanhas agora."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Campanhas de WhatsApp deste pedido</p>
          <p className="text-xs text-muted-foreground">
            Monte a partir de um post do Instagram. Tudo nasce pausado; você publica quando quiser.
          </p>
        </div>
        {!isCreating && (
          <Button size="sm" className="rounded-full" onClick={() => setIsCreating(true)}>
            <Plus className="mr-1 size-4" />
            Nova campanha de WhatsApp
          </Button>
        )}
      </div>

      {isCreating && (
        <CampaignDraftWizard
          orderId={orderId}
          context={context}
          durationDays={durationDays}
          onClose={() => setIsCreating(false)}
        />
      )}

      {context.campaigns.length > 0 ? (
        <ul className="space-y-2">
          {context.campaigns.map((campaign) => (
            <OrderCampaignCard key={campaign.id} orderId={orderId} campaign={campaign} context={context} />
          ))}
        </ul>
      ) : (
        !isCreating && (
          <p className="rounded-[20px] border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma campanha deste pedido na conta ainda.
          </p>
        )
      )}
    </div>
  );
}
