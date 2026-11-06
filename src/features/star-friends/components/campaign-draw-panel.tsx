"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, CircleAlert, Download, FlaskConical, MonitorPlay, ScanSearch, Trophy } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { cn } from "@/lib/utils";
import { useSweepStarFriendsCampaign } from "../hooks/use-star-friends-campaign";
import { CampaignDrawRevokeButton } from "./campaign-draw-revoke-button";
import { CampaignPrizeCountField } from "./campaign-prize-count";

type PanelDraw = {
  id: string;
  position: number;
  code: string;
  name: string;
  phone: string;
  displayName: string;
  actorName: string;
  drawnAt: Date | string;
  revokedAt: Date | string | null;
  revokedByName: string | null;
  revokeReason: string | null;
};

type PanelWinner = { position: number; code: string; name: string; phone: string };

type CampaignDrawPanelProps = {
  campaign: { id: string; prizeCount: number; lastSweepAt: Date | string | null; drawnAt: Date | string | null };
  stats: { validNumbers: number; participants: number; pendingReceipts: number; receiptsAfterSweep: number };
  draws: PanelDraw[];
  legacyWinners: PanelWinner[];
  canEdit: boolean;
  canApprove: boolean;
  isExporting: boolean;
  onExport: () => void;
};

function ReadinessItem({ isOk, children }: { isOk: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {isOk ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />}
      <span className={cn(!isOk && "font-medium")}>{children}</span>
    </li>
  );
}

export function CampaignDrawPanel({ campaign, stats, draws, legacyWinners, canEdit, canApprove, isExporting, onExport }: CampaignDrawPanelProps) {
  const sweep = useSweepStarFriendsCampaign();
  const activeDraws = draws.filter((draw) => !draw.revokedAt);
  const hasStarted = activeDraws.length > 0;
  // Campanha sorteada antes do sorteio ao vivo: só tem os ganhadores marcados nos números.
  const isLegacyDraw = Boolean(campaign.drawnAt) && draws.length === 0;
  const isComplete = Boolean(campaign.drawnAt);
  const isSweepFresh = Boolean(campaign.lastSweepAt) && stats.receiptsAfterSweep === 0;

  const statusLabel = isComplete ? "Concluído" : hasStarted ? `Em andamento · ${activeDraws.length} de ${campaign.prizeCount}` : "Não iniciado";

  return (
    <section className="flex flex-col gap-5 rounded-[24px] border border-warning/30 bg-gradient-to-br from-warning/10 via-card to-card p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-warning/20 text-warning">
            <Trophy className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Sorteio</h2>
            <p className="text-xs text-muted-foreground">
              {campaign.prizeCount} ganhador{campaign.prizeCount === 1 ? "" : "es"} · {stats.validNumbers} números válidos de {stats.participants} participantes
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            isComplete ? "bg-success/15 text-success" : hasStarted ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
      </div>

      {!isLegacyDraw && (
        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          <ul className="flex flex-col gap-2">
            <ReadinessItem isOk={isSweepFresh || hasStarted}>
              {hasStarted
                ? "Lista de números congelada no primeiro sorteado."
                : isSweepFresh
                  ? `Varredura de duplicados feita em ${format(new Date(campaign.lastSweepAt as Date | string), "dd/MM 'às' HH:mm")}.`
                  : campaign.lastSweepAt
                    ? `${stats.receiptsAfterSweep} cupom(ns) chegaram depois da última varredura. Faça outra.`
                    : "Faça a varredura de duplicados antes de sortear."}
            </ReadinessItem>
            <ReadinessItem isOk={stats.pendingReceipts === 0}>
              {stats.pendingReceipts === 0 ? "Nenhum cupom em conferência." : `${stats.pendingReceipts} cupom(ns) em conferência: aprove ou recuse antes.`}
            </ReadinessItem>
            <ReadinessItem isOk={stats.validNumbers > 0}>
              {stats.validNumbers > 0 ? `${stats.validNumbers} números concorrendo.` : "Ainda não há números válidos."}
            </ReadinessItem>
          </ul>
          {canEdit && (
            <CampaignPrizeCountField campaignId={campaign.id} prizeCount={campaign.prizeCount} winnersCount={activeDraws.length} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!isLegacyDraw && (
          <Button asChild className="h-11 rounded-full px-5" data-guide={GUIDE_ANCHORS.starFriendsLiveDraw.id}>
            <Link href="/star-friends/sorteio">
              <MonitorPlay className="size-4" /> {isComplete ? "Ver tela do sorteio" : hasStarted ? "Continuar sorteio ao vivo" : "Abrir sorteio ao vivo"}
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-11 rounded-full px-5" data-guide={GUIDE_ANCHORS.starFriendsDrawSimulator.id}>
          <Link href="/star-friends/sorteio?modo=simulacao">
            <FlaskConical className="size-4" /> Simular sorteio
          </Link>
        </Button>
        {canApprove && !hasStarted && !isComplete && (
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={sweep.isPending}
            onClick={() =>
              sweep.mutate(
                { campaignId: campaign.id },
                {
                  onSuccess: (result) => toast.success(`Varredura feita: ${result.receiptsVoided} cupom(ns) e ${result.numbersVoided} número(s) anulados.`),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            {sweep.isPending ? <OrbitaSpinner className="size-4" /> : <ScanSearch className="size-4" />} Varredura de duplicados
          </Button>
        )}
        <Button variant="ghost" className="h-11 rounded-full px-4" disabled={isExporting} onClick={onExport}>
          {isExporting ? <OrbitaSpinner className="size-4" /> : <Download className="size-4" />} Exportar números
        </Button>
      </div>

      {(draws.length > 0 || isLegacyDraw) && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Ganhadores</h3>
          <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-card">
            {isLegacyDraw &&
              legacyWinners.map((winner) => (
                <li key={winner.code} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning text-xs font-black text-black">{winner.position}º</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{winner.name}</span> · {winner.phone}
                  </span>
                  <span className="font-mono font-semibold">{winner.code}</span>
                </li>
              ))}
            {[...draws]
              .sort((first, second) => first.position - second.position || new Date(first.drawnAt).getTime() - new Date(second.drawnAt).getTime())
              .map((draw) => (
                <li key={draw.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm", draw.revokedAt && "opacity-60")}>
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-xs font-black",
                      draw.revokedAt ? "bg-muted text-muted-foreground" : "bg-warning text-black",
                    )}
                  >
                    {draw.position}º
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate", draw.revokedAt && "line-through")}>
                      <span className="font-semibold">{draw.name}</span> · {draw.phone}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {draw.revokedAt
                        ? `Revogado por ${draw.revokedByName ?? "—"} em ${format(new Date(draw.revokedAt), "dd/MM HH:mm")} · ${draw.revokeReason ?? ""}`
                        : `Sorteado por ${draw.actorName} em ${format(new Date(draw.drawnAt), "dd/MM HH:mm:ss")}`}
                    </p>
                  </div>
                  <span className={cn("font-mono font-semibold", draw.revokedAt && "line-through")}>{draw.code}</span>
                  {canApprove && !draw.revokedAt && <CampaignDrawRevokeButton draw={draw} />}
                </li>
              ))}
          </ol>
        </div>
      )}
    </section>
  );
}
