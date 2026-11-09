"use client";

import { format } from "date-fns";
import { ScanSearch, Star } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { useSweepStarFriendsCampaign } from "../hooks/use-star-friends-campaign";

// Quadro da campanha no modo pontos (spec 0135): sem sorteio. A varredura continua, como faxina de
// fraude, e estorna as ⭐ dos números que anula (RF-8 e RF-10).

type CampaignPointsPanelProps = {
  campaign: { id: string; name: string; isActive: boolean; lastSweepAt: Date | string | null };
  stats: { receiptsAfterSweep: number };
  canApprove: boolean;
};

export function CampaignPointsPanel({ campaign, stats, canApprove }: CampaignPointsPanelProps) {
  const sweep = useSweepStarFriendsCampaign();
  const sweepLine = campaign.lastSweepAt
    ? `Última varredura em ${format(new Date(campaign.lastSweepAt), "dd/MM 'às' HH:mm")}${stats.receiptsAfterSweep > 0 ? `; ${stats.receiptsAfterSweep} cupom(ns) chegaram depois.` : "."}`
    : "Nenhuma varredura feita ainda.";

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-chart-4">
          <Star className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold">
            {campaign.name} <span className="text-sm font-normal text-muted-foreground">· pontos de fidelidade</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            O cliente manda o cupom pelo WhatsApp e junta ⭐ para trocar pelos prêmios de &quot;Cartões e prêmios&quot;. Não há sorteio.
            {campaign.isActive ? "" : " A campanha está desligada: o WhatsApp não recebe cupons."}
          </p>
          <p className="text-xs text-muted-foreground">
            {sweepLine} A varredura anula cupom repetido que passou com leitura incompleta e estorna as ⭐ dele.
          </p>
        </div>
      </div>
      {canApprove && (
        <Button
          variant="outline"
          className="h-11 self-start rounded-full px-5"
          disabled={sweep.isPending}
          onClick={() =>
            sweep.mutate(
              { campaignId: campaign.id },
              {
                onSuccess: (result) => {
                  const reversed = "starsReversed" in result && typeof result.starsReversed === "number" && result.starsReversed > 0 ? `, ${result.starsReversed} ⭐ estornadas` : "";
                  toast.success(`Varredura feita: ${result.receiptsVoided} cupom(ns) anulados${reversed}.`);
                },
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          {sweep.isPending ? <OrbitaSpinner className="size-4" /> : <ScanSearch className="size-4" />} Varredura de duplicados
        </Button>
      )}
    </section>
  );
}
