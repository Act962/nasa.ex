"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Megaphone, Tag, Globe } from "lucide-react";
import {
  LeadsByMetricDialog,
  type LeadMetricKey,
} from "@/features/insights/components/leads-by-metric-dialog";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface OriginPanelProps {
  organizationIds?: string[];
  trackingId?: string;
  startDate?: string;
  endDate?: string;
}

const PIE_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#84cc16",
  "#ec4899",
  "#64748b",
];

export function OriginPanel({
  organizationIds,
  trackingId,
  startDate,
  endDate,
}: OriginPanelProps) {
  const [selected, setSelected] = useState<{
    metric: LeadMetricKey;
    title: string;
    extra: { source?: string; utmCampaign?: string; utmSource?: string };
  } | null>(null);

  const { data, isLoading } = useQuery(
    orpc.insights.getLeadOrigin.queryOptions({
      input: {
        organizationIds,
        trackingId,
        startDate,
        endDate,
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data || data.totalLeads === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum lead encontrado no período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Distribuição por canal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="size-5" />
            Por canal
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Origem de {data.totalLeads} leads
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.channels}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={(entry) => `${entry.label} (${entry.count})`}
                >
                  {data.channels.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1 text-xs">
            {data.channels.map((c, idx) => (
              <button
                key={c.source}
                type="button"
                onClick={() =>
                  setSelected({
                    metric: "lead.bySource",
                    title: `Leads por canal: ${c.label}`,
                    extra: { source: c.source },
                  })
                }
                className="flex items-center justify-between w-full text-left hover:bg-accent/40 rounded-md px-2 py-1 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="font-medium">{c.label}</span>
                </div>
                <div className="text-muted-foreground">
                  {c.count} ({c.conversionRate}% WON)
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top campanhas Meta */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="size-5" />
            Top campanhas Meta
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Campanhas que mais geraram conversa.
          </p>
        </CardHeader>
        <CardContent>
          {data.topMetaCampaigns.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Nenhuma campanha Meta vinculada a leads ainda.
              <br />
              Conecte sua integração Meta e use links com{" "}
              <code className="text-[10px]">utm_campaign</code> ou Click-to-WhatsApp ads.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topMetaCampaigns} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={140} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                  <Bar dataKey="won" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top UTM campaigns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="size-5" />
            Top UTM campaigns
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Campanhas externas (Google Ads, e-mail marketing, etc).
          </p>
        </CardHeader>
        <CardContent>
          {data.topUtmCampaigns.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Nenhum lead com <code className="text-[10px]">utm_campaign</code> ainda.
            </div>
          ) : (
            <div className="space-y-1">
              {data.topUtmCampaigns.map((c) => (
                <button
                  key={c.utmCampaign}
                  type="button"
                  onClick={() =>
                    setSelected({
                      metric: "lead.byUtmCampaign",
                      title: `Leads por campanha: ${c.utmCampaign}`,
                      extra: { utmCampaign: c.utmCampaign },
                    })
                  }
                  className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 w-full text-left hover:bg-accent/40 rounded-md px-2 transition-colors"
                >
                  <span className="truncate font-medium">{c.utmCampaign}</span>
                  <span className="text-muted-foreground tabular-nums">{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top UTM sources */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="size-5" />
            Top UTM sources
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            De onde os links levaram pra cá.
          </p>
        </CardHeader>
        <CardContent>
          {data.topUtmSources.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Nenhum lead com <code className="text-[10px]">utm_source</code> ainda.
            </div>
          ) : (
            <div className="space-y-1">
              {data.topUtmSources.map((c) => (
                <button
                  key={c.utmSource}
                  type="button"
                  onClick={() =>
                    setSelected({
                      metric: "lead.byUtmSource",
                      title: `Leads por origem: ${c.utmSource}`,
                      extra: { utmSource: c.utmSource },
                    })
                  }
                  className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 w-full text-left hover:bg-accent/40 rounded-md px-2 transition-colors"
                >
                  <span className="truncate font-medium">{c.utmSource}</span>
                  <span className="text-muted-foreground tabular-nums">{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {selected && (
        <LeadsByMetricDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          app="lead"
          metric={selected.metric}
          title={selected.title}
          extra={selected.extra}
        />
      )}
    </div>
  );
}
