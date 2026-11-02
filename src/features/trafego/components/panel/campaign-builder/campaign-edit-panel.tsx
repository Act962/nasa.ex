"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  useReplaceCampaignAd,
  useUpdateOrderCampaign,
  type useCampaignBuilderContext,
} from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  readAudienceFromTargeting,
  type AudienceDraft,
} from "@/features/trafego/lib/campaign-builder/build-meta-payloads";
import { estimateBudgetComplement } from "@/features/trafego/lib/campaign-builder/builder-rules";
import { AdSourcePicker, isAdSourceBlocked, toAdSourceInput, type AdSourceSelection } from "./ad-source-picker";
import { AudienceFields } from "./audience-fields";

/** Edição de uma campanha do pedido (spec 0124, RF-10): verba, fim, público e troca de anúncio. */

type BuilderContextData = NonNullable<ReturnType<typeof useCampaignBuilderContext>["data"]>;
type OrderCampaign = BuilderContextData["campaigns"][number];

export function CampaignEditPanel({
  orderId,
  campaign,
  context,
}: {
  orderId: string;
  campaign: OrderCampaign;
  context: BuilderContextData;
}) {
  const update = useUpdateOrderCampaign();
  const replaceAd = useReplaceCampaignAd();
  const firstAdset = campaign.adsets.find((adset) => adset.status !== "ARCHIVED") ?? campaign.adsets[0];
  const savedAudience = readAudienceFromTargeting(firstAdset?.targeting ?? null);

  const [budgetBrl, setBudgetBrl] = useState(String((campaign.lifetimeBudgetCents ?? 0) / 100));
  const [isComplementConfirmed, setIsComplementConfirmed] = useState(false);
  const [endDate, setEndDate] = useState(firstAdset?.endTime?.slice(0, 10) ?? "");
  const [audience, setAudience] = useState<AudienceDraft | null>(
    savedAudience ? { ...savedAudience, cityName: savedAudience.cityName ?? "Cidade atual" } : null,
  );
  const [adSource, setAdSource] = useState<AdSourceSelection | null>(null);
  const [isWarningConfirmed, setIsWarningConfirmed] = useState(false);

  const budgetBrlCents = Math.round((Number(budgetBrl.replace(",", ".")) || 0) * 100);
  const currentBudget = campaign.lifetimeBudgetCents ?? 0;
  const estimate = estimateBudgetComplement({
    budgetBrlCents: Math.max(0, budgetBrlCents - currentBudget),
    declaredBudgetBrlCents: context.budget.adBudgetBrlCents,
    spentBrlCents: currentBudget,
  });

  const notify = {
    onError: (error: Error) => toast.error(error.message),
  };

  return (
    <div className="mt-4 space-y-5 border-t pt-4">
      <section className="space-y-2">
        <p className="text-sm font-medium">Verba total</p>
        <div className="flex gap-2">
          <Input inputMode="decimal" value={budgetBrl} onChange={(event) => setBudgetBrl(event.target.value)} className="max-w-40" />
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending || budgetBrlCents === currentBudget || (estimate.needsConfirmation && !isComplementConfirmed)}
            onClick={() =>
              update.mutate(
                {
                  orderId,
                  campaignId: campaign.id,
                  change: { action: "budget", lifetimeBudgetBrlCents: budgetBrlCents, isComplementConfirmed },
                },
                { ...notify, onSuccess: () => toast.success("Verba atualizada.") },
              )
            }
          >
            Salvar verba
          </Button>
        </div>
        {estimate.needsConfirmation && (
          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={isComplementConfirmed} onCheckedChange={(value) => setIsComplementConfirmed(value === true)} />
            Passa do declarado em {formatBrlFromCents(estimate.excessBrlCents)}: complemento estimado de{" "}
            {formatBrlFromCents(estimate.estimatedComplementBrlCents)}. Quero seguir.
          </label>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Data de fim</p>
        <div className="flex gap-2">
          <Input type="date" value={endDate} min={context.today} onChange={(event) => setEndDate(event.target.value)} className="max-w-48" />
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending || !endDate}
            onClick={() =>
              update.mutate(
                { orderId, campaignId: campaign.id, change: { action: "end_date", endDate } },
                { ...notify, onSuccess: () => toast.success("Data de fim atualizada.") },
              )
            }
          >
            Salvar data
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Público</p>
        <AudienceFields orderId={orderId} audience={audience} onChange={setAudience} />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          Mudar o público faz a Meta revisar o anúncio de novo.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending || !audience}
          onClick={() =>
            audience &&
            update.mutate(
              { orderId, campaignId: campaign.id, change: { action: "audience", audience } },
              { ...notify, onSuccess: () => toast.success("Público atualizado. A Meta vai revisar de novo.") },
            )
          }
        >
          Salvar público
        </Button>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Trocar o anúncio</p>
        <p className="text-xs text-muted-foreground">
          O anúncio atual é pausado e um novo entra no lugar. Nada é apagado.
        </p>
        <AdSourcePicker
          orderId={orderId}
          pageId={firstAdset?.pageId ?? null}
          images={context.images}
          copies={context.copies}
          selection={adSource}
          onChange={(selection) => {
            setAdSource(selection);
            setIsWarningConfirmed(false);
          }}
          isWarningConfirmed={isWarningConfirmed}
          onWarningConfirmedChange={setIsWarningConfirmed}
        />
        <Button
          size="sm"
          disabled={replaceAd.isPending || isAdSourceBlocked(adSource, isWarningConfirmed)}
          onClick={() =>
            adSource &&
            replaceAd.mutate(
              {
                orderId,
                campaignId: campaign.id,
                source: toAdSourceInput(adSource),
                isPolicyWarningConfirmed: isWarningConfirmed,
              },
              {
                ...notify,
                onSuccess: () => {
                  toast.success("Anúncio novo criado; o anterior foi pausado.");
                  setAdSource(null);
                },
              },
            )
          }
        >
          Trocar anúncio
        </Button>
      </section>
    </div>
  );
}
