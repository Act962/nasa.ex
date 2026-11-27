"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { formatCents } from "../utils/campaign";
import { useExportStarFriendsCampaignNumbers, useStarFriendsCampaign } from "../hooks/use-star-friends-campaign";
import { CampaignDrawPanel } from "./campaign-draw-panel";
import { CampaignPointsPanel } from "./campaign-points-panel";
import { CampaignForm } from "./campaign-form";
import { CampaignReceipts } from "./campaign-receipts";
import { CampaignManualReceiptDialog } from "./campaign-manual-receipt-dialog";

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-card p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function CampaignManager({ canEdit, canApprove }: { canEdit: boolean; canApprove: boolean }) {
  const campaignQuery = useStarFriendsCampaign();
  const exportNumbers = useExportStarFriendsCampaignNumbers();

  if (campaignQuery.isLoading) return <OrbitaSpinner className="mx-auto my-10 size-6" />;
  const { campaign, stats, winners, draws, trackings } = campaignQuery.data ?? { campaign: null, stats: null, winners: [], draws: [], trackings: [] };

  const handleExport = (campaignId: string) =>
    exportNumbers.mutate(campaignId, {
      onSuccess: (result) => {
        const header = ["Número", "Situação", "Motivo", "Cliente", "Telefone", "Valor do cupom", "Compra em", "Gerado em"];
        const lines = result.luckyNumbers.map((luckyNumber) =>
          [
            luckyNumber.code,
            luckyNumber.status === "VALID" ? "Válido" : "Anulado",
            luckyNumber.voidReason ?? "",
            luckyNumber.member.name,
            luckyNumber.member.phone,
            luckyNumber.receipt.totalCents !== null ? formatCents(luckyNumber.receipt.totalCents) : "",
            luckyNumber.receipt.issuedAt ? format(new Date(luckyNumber.receipt.issuedAt), "dd/MM/yyyy HH:mm") : "",
            format(new Date(luckyNumber.createdAt), "dd/MM/yyyy HH:mm"),
          ]
            .map(toCsvCell)
            .join(";"),
        );
        const blob = new Blob([[header.map(toCsvCell).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `campanha-numeros-${format(new Date(), "yyyy-MM-dd")}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      onError: (error) => toast.error(error.message),
    });

  const hasDrawStarted = (campaignQuery.data?.draws ?? []).some((draw) => !draw.revokedAt);
  const isPoints = campaign?.mode === "POINTS";

  return (
    <div className="flex flex-col gap-5">
      {campaign && stats && (
        <>
          {isPoints ? (
            <CampaignPointsPanel campaign={campaign} stats={stats} canApprove={canApprove} />
          ) : (
            <CampaignDrawPanel
              campaign={campaign}
              stats={stats}
              draws={draws}
              legacyWinners={winners}
              canEdit={canEdit}
              canApprove={canApprove}
              isExporting={exportNumbers.isPending}
              onExport={() => handleExport(campaign.id)}
            />
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Participantes" value={String(stats.participants)} />
            <StatTile label="Cupons aceitos" value={String(stats.acceptedReceipts)} hint={formatCents(stats.acceptedTotalCents)} />
            <StatTile
              label={isPoints ? "⭐ geradas" : "Números válidos"}
              value={String(stats.validNumbers)}
              hint={stats.voidedNumbers > 0 ? `${stats.voidedNumbers} ${isPoints ? "estornadas ou anuladas" : "anulados"}` : undefined}
            />
            <StatTile
              label={stats.pendingReceipts > 0 ? "Em conferência" : "Com alerta"}
              value={String(stats.pendingReceipts > 0 ? stats.pendingReceipts : stats.flaggedReceipts)}
              hint={stats.pendingReceipts > 0 ? `${stats.flaggedReceipts} com alerta` : `${stats.duplicateReceipts} repetidos barrados`}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Cupons</h2>
              {canApprove && !campaign.drawnAt && !hasDrawStarted && (
                <CampaignManualReceiptDialog campaignId={campaign.id} amountPerNumberCents={campaign.amountPerNumberCents} />
              )}
            </div>
            <CampaignReceipts
              key={campaign.id}
              campaignId={campaign.id}
              canReview={canApprove && !campaign.drawnAt && !hasDrawStarted}
              canVoid={canApprove}
              pendingReceipts={stats.pendingReceipts}
            />
          </div>
        </>
      )}
      {canEdit && campaign && (campaign.drawnAt || hasDrawStarted) && (
        <p className="rounded-[18px] border border-line bg-card p-4 text-sm text-muted-foreground">
          O sorteio já começou: as regras da campanha ficam travadas. Só a quantidade de ganhadores pode mudar, no quadro do sorteio.
        </p>
      )}
      {canEdit && !campaign?.drawnAt && !hasDrawStarted && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{campaign ? "Configuração da campanha" : "Criar campanha por cupom"}</h2>
          {!campaign && (
            <p className="text-sm text-muted-foreground">
              O cliente manda a foto do cupom pelo WhatsApp e ganha números da sorte (sorteio) ou ⭐ para trocar por prêmios (pontos). Cupom repetido é barrado, e a varredura anula o que passou.
            </p>
          )}
          <CampaignForm campaign={campaign} trackings={trackings} />
        </div>
      )}
      {!campaign && !canEdit && <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>}
    </div>
  );
}
