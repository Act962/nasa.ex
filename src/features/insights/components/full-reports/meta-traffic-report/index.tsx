"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Heart,
  Layers,
  MapPin,
  MessageSquare,
  Minus,
  MousePointerClick,
  Play,
  Target,
  Users,
  UserSquare,
  Video,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignsBreakdown } from "./campaigns-breakdown";
import { ReportHeader } from "./report-header";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number, decimals = 2) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(v)}%`;
const fmtDecimal = (v: number, decimals = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

// ─── KPI Card no estilo do PDF ──────────────────────────────────────────────

type DeltaTone = "good" | "bad" | "neutral";

function KpiCard({
  label,
  value,
  prevValue,
  delta,
  icon: Icon,
  tone = "neutral",
  loading,
  highlight,
}: {
  label: string;
  value: string;
  prevValue?: string;
  delta: number | null;
  icon?: React.FC<{ className?: string }>;
  tone?: DeltaTone;
  loading?: boolean;
  highlight?: boolean;
}) {
  const renderDelta = () => {
    if (delta === null) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Minus className="size-3" /> sem comparativo
        </span>
      );
    }
    const isUp = delta > 0;
    const isDown = delta < 0;
    const positive = (isUp && tone === "good") || (isDown && tone === "bad");
    const negative = (isUp && tone === "bad") || (isDown && tone === "good");
    const ArrowIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-semibold",
          positive && "text-emerald-600 dark:text-emerald-400",
          negative && "text-red-600 dark:text-red-400",
          tone === "neutral" && !positive && !negative && "text-muted-foreground",
        )}
      >
        <ArrowIcon className="size-3" />
        {fmtPct(Math.abs(delta), 2)}
      </span>
    );
  };

  return (
    <Card className={cn(highlight && "border-primary/40 bg-primary/5")}>
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {Icon && <Icon className="size-3" />}
          <span className="truncate">{label}</span>
        </div>
        {loading ? (
          <>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {renderDelta()}
            </div>
            {prevValue && (
              <p className="text-[10px] text-muted-foreground">
                {prevValue} no período anterior
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section header (estilo do PDF) ─────────────────────────────────────────

function SectionBanner({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.FC<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 border-b pb-2 mb-3">
      {Icon && <Icon className="size-4 text-primary" />}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function PlaceholderTile({ label, height = 180 }: { label: string; height?: number }) {
  return (
    <Card className="border-dashed">
      <CardContent
        className="flex flex-col items-center justify-center p-6 text-center gap-2"
        style={{ minHeight: height }}
      >
        <ImageIcon className="size-5 text-muted-foreground/50" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">
          Em breve
        </Badge>
      </CardContent>
    </Card>
  );
}

// ─── Date range helpers ──────────────────────────────────────────────────────

function defaultDateRange() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { from: start, to: end };
}

function previousPeriodOf(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - ms);
  prevFrom.setHours(0, 0, 0, 0);
  prevTo.setHours(23, 59, 59, 999);
  return { from: prevFrom, to: prevTo };
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

// ─── Meta data hooks ─────────────────────────────────────────────────────────

function useMetaData(from: Date, to: Date) {
  const startDate = from.toISOString();
  const endDate = to.toISOString();
  const prev = previousPeriodOf(from, to);

  const current = useQuery(
    orpc.insights.getMetaTrafficOverview.queryOptions({
      input: { startDate, endDate },
    }),
  );
  const previous = useQuery(
    orpc.insights.getMetaTrafficOverview.queryOptions({
      input: {
        startDate: prev.from.toISOString(),
        endDate: prev.to.toISOString(),
      },
    }),
  );

  // Contagens distintas (Número de campanhas / anúncios)
  const campaignsCurrent = useQuery(
    orpc.metaAds.snapshots.list.queryOptions({
      input: { level: "campaign" as const, startDate, endDate },
    }),
  );
  const campaignsPrev = useQuery(
    orpc.metaAds.snapshots.list.queryOptions({
      input: {
        level: "campaign" as const,
        startDate: prev.from.toISOString(),
        endDate: prev.to.toISOString(),
      },
    }),
  );
  const adsCurrent = useQuery(
    orpc.metaAds.snapshots.list.queryOptions({
      input: { level: "ad" as const, startDate, endDate },
    }),
  );
  const adsPrev = useQuery(
    orpc.metaAds.snapshots.list.queryOptions({
      input: {
        level: "ad" as const,
        startDate: prev.from.toISOString(),
        endDate: prev.to.toISOString(),
      },
    }),
  );

  return {
    current,
    previous,
    prev,
    campaignsCurrent,
    campaignsPrev,
    adsCurrent,
    adsPrev,
  };
}

function distinctCount(snaps: { entityId: string }[] | undefined): number {
  if (!snaps) return 0;
  return new Set(snaps.map((s) => s.entityId)).size;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function MetaTrafficReport() {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(
    defaultDateRange(),
  );
  const fromDate = dateRange.from ?? defaultDateRange().from;
  const toDate = dateRange.to ?? defaultDateRange().to;
  const {
    current,
    previous,
    prev,
    campaignsCurrent,
    campaignsPrev,
    adsCurrent,
    adsPrev,
  } = useMetaData(fromDate, toDate);

  const isLoading = current.isLoading || previous.isLoading;
  const connected = current.data?.connected ?? false;
  const data = current.data?.data;
  const prevData = previous.data?.data;
  const days = useMemo(() => daysBetween(fromDate, toDate), [fromDate, toDate]);

  const numCampaigns = distinctCount(campaignsCurrent.data?.snapshots);
  const numCampaignsPrev = distinctCount(campaignsPrev.data?.snapshots);
  const numAds = distinctCount(adsCurrent.data?.snapshots);
  const numAdsPrev = distinctCount(adsPrev.data?.snapshots);

  const dailyAvgSpend = data ? data.spend / days : 0;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <ReportHeader
        from={fromDate}
        to={toDate}
        prevFrom={prev.from}
        prevTo={prev.to}
        onChangeRange={setDateRange}
      />

      {!connected && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <h3 className="font-semibold">Sem dados Meta para este período</h3>
            <p className="text-sm text-muted-foreground">
              Conecte uma conta Meta em Integrações ou rode o seed de demo
              (`npx tsx prisma/seed-meta-ads-demo.ts`) para popular o relatório.
            </p>
            <Button asChild>
              <a href="/integrations">Conectar Meta</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 1. Informações Gerais (8 cards em 2 fileiras de 4) ──────────── */}
      <section>
        <SectionBanner
          title="Informações Gerais"
          subtitle="Principais informações da conta no período. Comparação contra o período anterior de mesma duração."
          icon={Layers}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Linha 1 */}
          <KpiCard
            label="Valor Investido"
            value={data ? fmtCurrency(data.spend) : "—"}
            prevValue={prevData ? fmtCurrency(prevData.spend) : undefined}
            delta={data && prevData ? pctDelta(data.spend, prevData.spend) : null}
            icon={Wallet}
            loading={isLoading}
          />
          <KpiCard
            label="Conversas iniciadas por mensagem"
            value={data ? fmtInt(data.conversions) : "—"}
            prevValue={prevData ? fmtInt(prevData.conversions) : undefined}
            delta={
              data && prevData ? pctDelta(data.conversions, prevData.conversions) : null
            }
            icon={MessageSquare}
            tone="good"
            loading={isLoading}
          />
          <KpiCard
            label="Custo por conversas iniciadas por mensagem por campanhas"
            value={data ? fmtCurrency(data.cpa) : "—"}
            prevValue={prevData ? fmtCurrency(prevData.cpa) : undefined}
            delta={data && prevData ? pctDelta(data.cpa, prevData.cpa) : null}
            icon={Target}
            tone="bad"
            loading={isLoading}
          />
          <KpiCard
            label="Número de campanhas"
            value={fmtInt(numCampaigns)}
            prevValue={fmtInt(numCampaignsPrev)}
            delta={pctDelta(numCampaigns, numCampaignsPrev)}
            icon={Layers}
            tone="neutral"
            loading={campaignsCurrent.isLoading || campaignsPrev.isLoading}
          />
          {/* Linha 2 */}
          <KpiCard
            label="Impressões"
            value={data ? fmtInt(data.impressions) : "—"}
            prevValue={prevData ? fmtInt(prevData.impressions) : undefined}
            delta={
              data && prevData ? pctDelta(data.impressions, prevData.impressions) : null
            }
            icon={Eye}
            tone="good"
            loading={isLoading}
          />
          <KpiCard
            label="Alcance no Instagram"
            value="—"
            delta={null}
            icon={Instagram}
            loading={false}
          />
          <KpiCard
            label="Visitas do perfil"
            value="—"
            delta={null}
            icon={UserSquare}
            loading={false}
          />
          <KpiCard
            label="Número de anúncios"
            value={fmtInt(numAds)}
            prevValue={fmtInt(numAdsPrev)}
            delta={pctDelta(numAds, numAdsPrev)}
            icon={Layers}
            tone="neutral"
            loading={adsCurrent.isLoading || adsPrev.isLoading}
          />
        </div>
      </section>

      {/* ── 2. Distribuições demográficas (2x2) ───────────────────────────── */}
      <section>
        <SectionBanner
          title="Distribuições"
          subtitle="Quebras por idade, gênero, plataforma e investimento diário."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PlaceholderTile label="Impressões e alcance por idade" />
          <PlaceholderTile label="Alcance por plataforma" />
          <PlaceholderTile label="Impressões e alcance por gênero" />
          <PlaceholderTile label="Valor investido por dia" />
        </div>
      </section>

      {/* ── 3. Regiões com maior alcance ─────────────────────────────────── */}
      <section>
        <SectionBanner
          title="Regiões com maior alcance"
          subtitle="Top regiões por alcance, impressões, frequência, investimento e CPM."
          icon={MapPin}
        />
        <PlaceholderTile
          label="Tabela de regiões — requer breakdown geográfico (region) na sincronização Meta"
          height={140}
        />
      </section>

      {/* ── 4. Meta Ads — Bloco principal ─────────────────────────────────── */}
      <section className="space-y-4">
        <SectionBanner
          title="Meta Ads"
          subtitle="Métricas detalhadas do tráfego pago"
        />

        {/* Texto educativo */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Métricas importantes referente ao alcance vindo do tráfego
            </p>
            <p>
              <strong className="text-foreground">Alcance</strong> é o número de
              pessoas <strong>únicas</strong> que viram o anúncio.
            </p>
            <p>
              <strong className="text-foreground">Impressões</strong> é a quantidade
              de <strong>vezes</strong> que o anúncio foi visto (uma pessoa pode ter
              visto mais de uma vez).
            </p>
            <p>
              <strong className="text-foreground">Frequência</strong> é o número de
              vezes que as pessoas alcançadas viram o anúncio (impressões ÷ alcance).
            </p>
            <p>
              <strong className="text-foreground">Custo por Mil Impressões</strong>{" "}
              é quanto pagou para o anúncio aparecer a cada mil vezes.
            </p>
          </CardContent>
        </Card>

        {/* Investimento — 2 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KpiCard
            label="Valor investido"
            value={data ? fmtCurrency(data.spend) : "—"}
            prevValue={prevData ? fmtCurrency(prevData.spend) : undefined}
            delta={data && prevData ? pctDelta(data.spend, prevData.spend) : null}
            icon={Wallet}
            loading={isLoading}
          />
          <KpiCard
            label={`Valor investido médio diário (${days} dias)`}
            value={data ? fmtCurrency(dailyAvgSpend) : "—"}
            delta={null}
            icon={Wallet}
            loading={isLoading}
          />
        </div>

        {/* 3 cards: Alcance Total | Conversas | Alcance Instagram */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Alcance Total"
            value={data ? fmtInt(data.reach) : "—"}
            prevValue={prevData ? fmtInt(prevData.reach) : undefined}
            delta={data && prevData ? pctDelta(data.reach, prevData.reach) : null}
            icon={Users}
            tone="good"
            loading={isLoading}
          />
          <KpiCard
            label="Conversas iniciadas por mensagem"
            value={data ? fmtInt(data.conversions) : "—"}
            prevValue={prevData ? fmtInt(prevData.conversions) : undefined}
            delta={
              data && prevData ? pctDelta(data.conversions, prevData.conversions) : null
            }
            icon={MessageSquare}
            tone="good"
            loading={isLoading}
          />
          <KpiCard
            label="Alcance no Instagram"
            value="—"
            delta={null}
            icon={Instagram}
          />
        </div>

        {/* 3 cards: Impressões Totais | CPM médio | Custo por conversa */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Impressões Totais"
            value={data ? fmtInt(data.impressions) : "—"}
            prevValue={prevData ? fmtInt(prevData.impressions) : undefined}
            delta={
              data && prevData ? pctDelta(data.impressions, prevData.impressions) : null
            }
            icon={Eye}
            tone="good"
            loading={isLoading}
          />
          <KpiCard
            label="Custo Por Mil Impressões médio"
            value={data ? fmtCurrency(data.cpm) : "—"}
            prevValue={prevData ? fmtCurrency(prevData.cpm) : undefined}
            delta={data && prevData ? pctDelta(data.cpm, prevData.cpm) : null}
            icon={Zap}
            tone="bad"
            loading={isLoading}
          />
          <KpiCard
            label="Custo por conversas iniciadas por mensagem"
            value={data ? fmtCurrency(data.cpa) : "—"}
            prevValue={prevData ? fmtCurrency(prevData.cpa) : undefined}
            delta={data && prevData ? pctDelta(data.cpa, prevData.cpa) : null}
            icon={Target}
            tone="bad"
            loading={isLoading}
          />
        </div>

        {/* Demográficos — 2 placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PlaceholderTile label="Impressões e alcance por idade" />
          <PlaceholderTile label="Impressões e alcance por gênero" />
        </div>

        {/* 3 cards: CTR | CPC médio | Total de cliques no link */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="CTR (Taxa de cliques no link)"
            value={data ? fmtPct(data.ctr) : "—"}
            prevValue={prevData ? fmtPct(prevData.ctr) : undefined}
            delta={data && prevData ? pctDelta(data.ctr, prevData.ctr) : null}
            icon={MousePointerClick}
            tone="good"
            loading={isLoading}
          />
          <KpiCard
            label="CPC médio"
            value={data ? fmtCurrency(data.cpc) : "—"}
            prevValue={prevData ? fmtCurrency(prevData.cpc) : undefined}
            delta={data && prevData ? pctDelta(data.cpc, prevData.cpc) : null}
            icon={MousePointerClick}
            tone="bad"
            loading={isLoading}
          />
          <KpiCard
            label="Total de cliques no link"
            value={data ? fmtInt(data.clicks) : "—"}
            prevValue={prevData ? fmtInt(prevData.clicks) : undefined}
            delta={data && prevData ? pctDelta(data.clicks, prevData.clicks) : null}
            icon={MousePointerClick}
            tone="good"
            loading={isLoading}
          />
        </div>

        {/* Card destacado: Engajamento social */}
        <KpiCard
          label="Comentários + Salvamentos + Compartilhamentos"
          value={data ? fmtInt(data.engagement) : "—"}
          prevValue={prevData ? fmtInt(prevData.engagement) : undefined}
          delta={
            data && prevData ? pctDelta(data.engagement, prevData.engagement) : null
          }
          icon={Heart}
          tone="good"
          loading={isLoading}
          highlight
        />

        {/* Vídeo — 3 cards (extra, comum em relatórios Meta) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Vídeo: visualizações"
            value={data ? fmtInt(data.videoPlays) : "—"}
            delta={null}
            icon={Play}
            loading={isLoading}
          />
          <KpiCard
            label="Vídeo: ThruPlays (75%+)"
            value={data ? fmtInt(data.thruPlays) : "—"}
            delta={null}
            icon={Video}
            loading={isLoading}
          />
          <KpiCard
            label="Tempo médio de visualização"
            value={data ? `${fmtDecimal(data.avgWatchTime)} s` : "—"}
            delta={null}
            icon={Video}
            loading={isLoading}
          />
        </div>
      </section>

      {/* ── 5. Campanhas ────────────────────────────────────────────────── */}
      <section>
        <SectionBanner
          title="Campanhas"
          subtitle="Desempenho por campanha. Cada bloco mostra investimento, alcance, conversões e os anúncios em destaque."
          icon={Target}
        />
        <CampaignsBreakdown
          startDate={fromDate.toISOString()}
          endDate={toDate.toISOString()}
        />
      </section>

      {/* ── 6. Instagram Business ───────────────────────────────────────── */}
      <section>
        <SectionBanner
          title="Instagram Business"
          subtitle="Alcance, audiência e desempenho de Reels orgânicos."
          icon={Instagram}
        />
        {/* 4 cards no topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Visualizações totais (orgânicas + pagas)" value="—" delta={null} icon={Eye} />
          <KpiCard label="Salvamentos" value="—" delta={null} icon={Heart} />
          <KpiCard label="Taxa de Interação de Reels" value="—" delta={null} icon={Video} />
          <KpiCard label="Visitas do perfil" value="—" delta={null} icon={UserSquare} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PlaceholderTile label="Alcance diário" />
          <PlaceholderTile label="Audiência por idade e gênero" />
          <PlaceholderTile label="Melhor horário para postagens" />
          <PlaceholderTile label="Cidades com maior número de seguidores" />
        </div>

        {/* Postagens em destaque (placeholder grid visual) */}
        <Card className="mt-3 border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Postagens em destaque
              </h4>
              <Badge variant="outline" className="text-[10px]">
                Em breve · Instagram Insights API
              </Badge>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md bg-muted flex items-center justify-center"
                >
                  <ImageIcon className="size-5 text-muted-foreground/30" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reels em destaque (placeholder grid visual) */}
        <Card className="mt-3 border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Reels em destaque
              </h4>
              <Badge variant="outline" className="text-[10px]">
                Em breve · Instagram Insights API
              </Badge>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[9/16] rounded-md bg-muted flex items-center justify-center"
                >
                  <Video className="size-5 text-muted-foreground/30" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── 7. Facebook ─────────────────────────────────────────────────── */}
      <section>
        <SectionBanner
          title="Facebook"
          subtitle="Seguidores, alcance da página e postagens em destaque."
          icon={Facebook}
        />
        {/* 4 cards no topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <KpiCard label="Seguidores da página" value="—" delta={null} icon={Users} />
          <KpiCard label="Novos seguidores da página" value="—" delta={null} icon={Users} />
          <KpiCard label="Alcance total da página" value="—" delta={null} icon={Eye} />
          <KpiCard label="Total de visualizações da página" value="—" delta={null} icon={Eye} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PlaceholderTile label="Crescimento de seguidores" />
          <PlaceholderTile label="Evolução do alcance da página" />
          <PlaceholderTile label="Cidades com maior número de seguidores" />
          <PlaceholderTile label="Melhor dia para postagens" />
        </div>

        {/* Postagens em destaque (placeholder grid) */}
        <Card className="mt-3 border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Postagens em destaque
              </h4>
              <Badge variant="outline" className="text-[10px]">
                Em breve · Facebook Pages Insights API
              </Badge>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md bg-muted flex items-center justify-center"
                >
                  <ImageIcon className="size-5 text-muted-foreground/30" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Rodapé ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <span>
          Período: {fromDate.toLocaleDateString("pt-BR")} →{" "}
          {toDate.toLocaleDateString("pt-BR")} ({days} dias)
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Download className="size-3.5" /> Exportar (Imprimir / PDF)
        </Button>
      </div>
    </div>
  );
}
