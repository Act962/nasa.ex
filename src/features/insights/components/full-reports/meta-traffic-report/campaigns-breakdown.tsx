"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Image as ImageIcon, Target } from "lucide-react";

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDecimal = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);

type Snapshot = {
  entityId: string;
  entityName: string | null;
  reach: number | string;
  impressions: number;
  frequency: number | string;
  clicks: number;
  ctr: number | string;
  engagement: number;
  spend: number | string;
  cpm: number | string;
  cpc: number | string;
  cpa: number | string;
  conversions: number;
  leads: number;
};

type Aggregated = {
  entityId: string;
  entityName: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  engagement: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  frequency: number;
};

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? parseFloat(v) : v;
}

function aggregate(snapshots: Snapshot[]): Aggregated[] {
  const byEntity = new Map<string, Aggregated>();
  for (const s of snapshots) {
    const key = s.entityId;
    const spend = toNum(s.spend);
    const impressions = s.impressions ?? 0;
    const clicks = s.clicks ?? 0;
    const reach = toNum(s.reach);
    const conversions = s.conversions ?? 0;
    const leads = s.leads ?? 0;
    const engagement = s.engagement ?? 0;
    const existing = byEntity.get(key);
    if (!existing) {
      byEntity.set(key, {
        entityId: key,
        entityName: s.entityName ?? key,
        spend,
        reach,
        impressions,
        clicks,
        conversions,
        leads,
        engagement,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cpa: 0,
        frequency: 0,
      });
    } else {
      existing.spend += spend;
      existing.reach = Math.max(existing.reach, reach);
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.conversions += conversions;
      existing.leads += leads;
      existing.engagement += engagement;
    }
  }
  return Array.from(byEntity.values())
    .map((a) => ({
      ...a,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
      cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
      cpa: a.conversions > 0 ? a.spend / a.conversions : 0,
      frequency: a.reach > 0 ? a.impressions / a.reach : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// ── Mini KPI ───────────────────────────────────────────────────────────────

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
        {label}
      </p>
      <p className="text-base font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function PlaceholderMiniTile({ label }: { label: string }) {
  return (
    <div className="border border-dashed rounded-md flex flex-col items-center justify-center gap-1 p-3 text-center min-h-[120px]">
      <ImageIcon className="size-4 text-muted-foreground/40" />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <Badge variant="outline" className="text-[9px] py-0 px-1">
        Em breve
      </Badge>
    </div>
  );
}

// ── Thumbnail do anúncio ───────────────────────────────────────────────────

function AdThumb({
  url,
  alt,
  size = 40,
}: {
  url: string | null | undefined;
  alt: string;
  size?: number;
}) {
  if (!url) {
    return (
      <div
        className="rounded-md bg-muted flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <ImageIcon className="size-4 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="rounded-md object-cover shrink-0 border bg-muted"
      style={{ width: size, height: size }}
    />
  );
}

// ── Card de campanha ───────────────────────────────────────────────────────

type TopAd = {
  metaAdId: string;
  name: string;
  thumbnailUrl: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  engagement: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
};

function CampaignCard({
  campaign,
  ads,
}: {
  campaign: Aggregated;
  ads: TopAd[];
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {campaign.entityId}
            </p>
            <h4 className="font-bold text-base truncate">{campaign.entityName}</h4>
          </div>
          <Badge variant="secondary" className="shrink-0 font-bold">
            {fmtCurrency(campaign.spend)}
          </Badge>
        </div>

        {/* KPIs linha 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniKpi label="Valor investido" value={fmtCurrency(campaign.spend)} />
          <MiniKpi label="Alcance Total" value={fmtInt(campaign.reach)} />
          <MiniKpi
            label="Conversas iniciadas por mensagem"
            value={fmtInt(campaign.conversions)}
          />
          <MiniKpi
            label="Custo por conversas iniciadas por mensagem"
            value={campaign.cpa > 0 ? fmtCurrency(campaign.cpa) : "—"}
          />
        </div>

        {/* KPIs linha 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t pt-3">
          <MiniKpi label="Impressões Totais" value={fmtInt(campaign.impressions)} />
          <MiniKpi
            label="CPC Médio Total"
            value={campaign.cpc > 0 ? fmtCurrency(campaign.cpc) : "—"}
          />
          <MiniKpi label="Total de Cliques" value={fmtInt(campaign.clicks)} />
          <MiniKpi
            label="Frequência"
            value={fmtDecimal(campaign.frequency)}
          />
        </div>

        {/* Demográficos placeholders */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <PlaceholderMiniTile label="Por idade" />
          <PlaceholderMiniTile label="Por gênero" />
          <PlaceholderMiniTile label="Por plataforma" />
          <PlaceholderMiniTile label="Por hora" />
        </div>

        {/* Anúncios em destaque */}
        {ads.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-baseline justify-between">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Anúncios em destaque
              </h5>
              <span className="text-[10px] text-muted-foreground">
                Top {ads.length} por investimento
              </span>
            </div>

            {/* Galeria de thumbnails (visual rápido) */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ads.slice(0, 6).map((ad) => (
                <div
                  key={ad.metaAdId}
                  className="flex flex-col items-center gap-1 min-w-[88px]"
                  title={ad.name}
                >
                  <AdThumb url={ad.thumbnailUrl} alt={ad.name} size={88} />
                  <p className="text-[10px] text-center text-muted-foreground line-clamp-2 max-w-[88px]">
                    {ad.name}
                  </p>
                  <Badge variant="outline" className="text-[9px] py-0 px-1">
                    {fmtCurrency(ad.spend)}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Tabela detalhada */}
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] uppercase tracking-wide">
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Anúncio</TableHead>
                    <TableHead className="text-right">Resultados</TableHead>
                    <TableHead className="text-right">Custo por resultados</TableHead>
                    <TableHead className="text-right">Valor investido</TableHead>
                    <TableHead className="text-right">Alcance</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">CPM</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead className="text-right">Engajamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.map((ad) => (
                    <TableRow key={ad.metaAdId} className="text-xs">
                      <TableCell className="py-2">
                        <AdThumb url={ad.thumbnailUrl} alt={ad.name} size={36} />
                      </TableCell>
                      <TableCell
                        className="font-medium max-w-[220px] truncate"
                        title={ad.name}
                      >
                        {ad.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(ad.conversions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ad.cpa > 0 ? fmtCurrency(ad.cpa) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtCurrency(ad.spend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(ad.reach)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(ad.impressions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ad.cpm > 0 ? fmtCurrency(ad.cpm) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(ad.clicks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ad.cpc > 0 ? fmtCurrency(ad.cpc) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(ad.engagement)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export function CampaignsBreakdown({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const campaignsQuery = useQuery(
    orpc.metaAds.snapshots.list.queryOptions({
      input: { level: "campaign" as const, startDate, endDate },
    }),
  );
  const topAdsQuery = useQuery(
    orpc.metaAds.getTopAds.queryOptions({
      input: { startDate, endDate, limit: 12 },
    }),
  );

  const isLoading = campaignsQuery.isLoading || topAdsQuery.isLoading;

  const campaigns = useMemo(() => {
    const snaps = (campaignsQuery.data?.snapshots ?? []) as unknown as Snapshot[];
    return aggregate(snaps);
  }, [campaignsQuery.data]);

  const topAds = (topAdsQuery.data?.ads ?? []) as TopAd[];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-64" />
              <div className="grid grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-12" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Target className="size-6 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha com dados no período selecionado.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Rode o seed `npx tsx prisma/seed-meta-ads-demo.ts` ou conecte uma
            conta Meta ativa.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign, idx) => (
        <CampaignCard
          key={campaign.entityId}
          campaign={campaign}
          // Top 8 anúncios entram no card da campanha de maior gasto.
          // Quando o snapshot trouxer campaignId no registro de ad, podemos
          // distribuir os ads pelo card correto via campaignId.
          ads={idx === 0 ? topAds.slice(0, 8) : []}
        />
      ))}
    </div>
  );
}
