"use client";

import { format } from "date-fns";
import { Download, ScanSearch, Trophy } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatCents } from "../utils/campaign";
import {
  useDrawStarFriendsCampaign,
  useExportStarFriendsCampaignNumbers,
  useStarFriendsCampaign,
  useSweepStarFriendsCampaign,
} from "../hooks/use-star-friends-campaign";
import { CampaignForm } from "./campaign-form";
import { CampaignReceipts } from "./campaign-receipts";

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
  const sweep = useSweepStarFriendsCampaign();
  const draw = useDrawStarFriendsCampaign();
  const exportNumbers = useExportStarFriendsCampaignNumbers();

  if (campaignQuery.isLoading) return <OrbitaSpinner className="mx-auto my-10 size-6" />;
  const { campaign, stats, winners, trackings } = campaignQuery.data ?? { campaign: null, stats: null, winners: [], trackings: [] };

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

  return (
    <div className="flex flex-col gap-5">
      {campaign && stats && (
        <>
          {winners.length > 0 && (
            <div className="flex items-start gap-3 rounded-[20px] border border-warning/40 bg-warning/10 p-4">
              <Trophy className="mt-0.5 size-6 shrink-0 text-warning" />
              <div className="min-w-0 text-sm">
                <p className="font-bold">
                  {winners.length === 1 ? "Número sorteado" : `${winners.length} números sorteados`}
                  {campaign.drawnAt ? ` em ${format(new Date(campaign.drawnAt), "dd/MM/yyyy HH:mm")}` : ""}
                </p>
                <ol className="mt-1 flex flex-col gap-0.5">
                  {winners.map((winner) => (
                    <li key={winner.code} className="truncate text-muted-foreground">
                      {winner.position}º · <span className="font-mono font-semibold text-foreground">{winner.code}</span> · {winner.name} · {winner.phone}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Participantes" value={String(stats.participants)} />
            <StatTile label="Cupons aceitos" value={String(stats.acceptedReceipts)} hint={formatCents(stats.acceptedTotalCents)} />
            <StatTile label="Números válidos" value={String(stats.validNumbers)} hint={stats.voidedNumbers > 0 ? `${stats.voidedNumbers} anulados` : undefined} />
            <StatTile
              label={stats.pendingReceipts > 0 ? "Em conferência" : "Com alerta"}
              value={String(stats.pendingReceipts > 0 ? stats.pendingReceipts : stats.flaggedReceipts)}
              hint={stats.pendingReceipts > 0 ? `${stats.flaggedReceipts} com alerta` : `${stats.duplicateReceipts} repetidos barrados`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && !campaign.drawnAt && (
              <Button
                variant="outline"
                className="rounded-full"
                disabled={sweep.isPending}
                onClick={() =>
                  sweep.mutate(
                    { campaignId: campaign.id },
                    {
                      onSuccess: (result) =>
                        toast.success(`Varredura feita: ${result.receiptsVoided} cupom(ns) e ${result.numbersVoided} número(s) anulados.`),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                {sweep.isPending ? <OrbitaSpinner className="size-4" /> : <ScanSearch className="size-4" />} Varredura de duplicados
              </Button>
            )}
            {canApprove && !campaign.drawnAt && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="rounded-full" disabled={draw.isPending || !campaign.lastSweepAt || stats.receiptsAfterSweep > 0 || stats.pendingReceipts > 0}>
                    <Trophy className="size-4" /> Sortear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sortear agora?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O sorteio tira {campaign.prizeCount} número(s) entre {stats.validNumbers} válidos, um prêmio por cliente, encerra a campanha e não pode ser refeito.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        draw.mutate(
                          { campaignId: campaign.id },
                          {
                            onSuccess: (result) => toast.success(`Sorteados: ${result.winners.map((winner) => winner.code).join(", ")}`),
                            onError: (error) => toast.error(error.message),
                          },
                        )
                      }
                    >
                      Sortear
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" className="rounded-full" disabled={exportNumbers.isPending} onClick={() => handleExport(campaign.id)}>
              {exportNumbers.isPending ? <OrbitaSpinner className="size-4" /> : <Download className="size-4" />} Exportar números
            </Button>
            <span className="text-xs text-muted-foreground">
              {campaign.lastSweepAt
                ? `Última varredura: ${format(new Date(campaign.lastSweepAt), "dd/MM HH:mm")}${stats.receiptsAfterSweep > 0 ? ` · ${stats.receiptsAfterSweep} cupom(ns) depois dela` : ""}`
                : "Faça a varredura antes de sortear."}
            </span>
          </div>
          <CampaignReceipts key={campaign.id} campaignId={campaign.id} canReview={canApprove && !campaign.drawnAt} pendingReceipts={stats.pendingReceipts} />
        </>
      )}
      {canEdit && !campaign?.drawnAt && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{campaign ? "Configuração da campanha" : "Criar campanha de sorteio"}</h2>
          {!campaign && (
            <p className="text-sm text-muted-foreground">
              O cliente manda a foto do cupom pelo WhatsApp e ganha números da sorte. Cupom repetido é barrado, e uma varredura antes do sorteio anula o que passou.
            </p>
          )}
          <CampaignForm campaign={campaign} trackings={trackings} />
        </div>
      )}
      {!campaign && !canEdit && <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>}
    </div>
  );
}
