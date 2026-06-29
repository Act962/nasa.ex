"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, TrendingDown, Globe } from "lucide-react";
import { useInsightsStore } from "@/features/insights/context/use-insights";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RescuePanel } from "@/features/insights/components/lead-rescue/rescue-panel";
import { FunnelPanel } from "@/features/insights/components/lead-funnel/funnel-panel";
import { OriginPanel } from "@/features/insights/components/lead-origin/origin-panel";

export function JornadaPanel() {
  const trackingId = useInsightsStore((s) => s.trackingId);
  const setTrackingId = useInsightsStore((s) => s.setTrackingId);
  const organizationIds = useInsightsStore((s) => s.organizationIds);
  const [activeTab, setActiveTab] = useState<"rescue" | "funnel" | "origin">(
    "rescue",
  );

  // Lista de trackings da org ativa (sem filtro por organizationIds — `tracking.list`
  // já usa o contexto do org ativo, que é o que queremos pro Jornada panel).
  const { data: trackings } = useQuery(
    orpc.tracking.list.queryOptions({}),
  );

  const trackingOptions = useMemo(() => {
    return (trackings ?? []).map((t: any) => ({ id: t.id, name: t.name }));
  }, [trackings]);

  // Auto-seleciona o primeiro tracking quando o usuário ainda não selecionou
  // — o painel Funil exige tracking pra renderizar, então é melhor já preencher.
  useEffect(() => {
    if (!trackingId && trackingOptions.length > 0) {
      setTrackingId(trackingOptions[0].id);
    }
  }, [trackingId, trackingOptions, setTrackingId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Jornada do Lead</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Saiba quem precisa ser resgatado, em que etapa cada lead está e de onde veio.
          </p>
        </div>
        {trackingOptions.length > 0 && (
          <Select
            value={trackingId ?? ""}
            onValueChange={(v) => setTrackingId(v)}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Selecione um tracking" />
            </SelectTrigger>
            <SelectContent>
              {trackingOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      >
        <TabsList>
          <TabsTrigger value="rescue" className="gap-2">
            <AlertTriangle className="size-4" />
            Para Resgatar
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2">
            <TrendingDown className="size-4" />
            Funil
          </TabsTrigger>
          <TabsTrigger value="origin" className="gap-2">
            <Globe className="size-4" />
            Origem
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rescue" className="mt-4">
          <RescuePanel
            organizationIds={organizationIds}
            trackingId={trackingId}
          />
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          <FunnelPanel
            trackingId={trackingId}
            organizationIds={organizationIds}
          />
        </TabsContent>

        <TabsContent value="origin" className="mt-4">
          <OriginPanel
            organizationIds={organizationIds}
            trackingId={trackingId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
