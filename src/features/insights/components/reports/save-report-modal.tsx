"use client";

import { useState } from "react";
import { Save, Check } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useChartsSnapshot } from "@/features/insights/hooks/use-charts-snapshot";
import { useOrgLayoutOptional } from "@/features/insights/context/org-layout-provider";
import {
  getDefaultVisibleKeys,
} from "@/features/insights/lib/insights-metric-catalog";
import { ALL_MODULES, type AppModule } from "@/features/insights/types";
import type { KpiCardStyle } from "@/features/insights/lib/kpi-card-style";
import type { InsightBlock } from "@/features/insights/lib/app-metrics";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

interface SaveReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  filters: any;
  modules: string[];
  snapshot: any;
  aiNarrative?: string;
}

export function SaveReportModal({
  open,
  onOpenChange,
  defaultName = "",
  filters,
  modules,
  snapshot,
  aiNarrative,
}: SaveReportModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Captura as preferências de visibilidade de KPIs por seção (section-prefs)
  // do layout da org — congelado no snapshot pra reproduzir a UI no relatório.
  // Usa variante opcional pra funcionar também em rotas full-screen (como
  // `/insights/relatorios/trafego-meta`) que não envolvem o OrgLayoutProvider:
  // sem layout custom, caímos no default do catálogo.
  const layout = useOrgLayoutOptional();
  const blocks = layout?.blocks ?? [];
  const captureChartsSnapshot = useChartsSnapshot();
  const [isCapturingCharts, setIsCapturingCharts] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: (vars: {
      name: string;
      description?: string;
      filters: any;
      modules: string[];
      snapshot: any;
      aiNarrative?: string;
      generateShareToken: boolean;
    }) => orpc.insights.saveReport.call(vars),
    onSuccess: (data) => {
      toast.success("Relatório salvo!");
      emitTourResult({ kind: GUIDE_RESULT_KINDS.reportSaved });
      setSavedToken(data.report.shareToken ?? null);
      queryClient.invalidateQueries({ queryKey: ["insights", "listSavedReports"] });
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${(err as Error).message}`);
    },
  });

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Dê um nome ao relatório");
      return;
    }
    // Mescla sectionPrefs (visibleKeys por app) do layout corrente da org
    // no snapshot. Pra apps sem section-prefs persistido, congela os
    // defaultVisible do catálogo — assim o relatório sempre reproduz a
    // mesma combinação de KPIs que estava no dashboard no momento do save.
    const sectionPrefs: Record<string, string[]> = {};
    const sectionCardStyles: Record<string, Record<string, KpiCardStyle>> = {};
    for (const appModule of ALL_MODULES) {
      const prefsBlock = blocks.find(
        (b): b is Extract<InsightBlock, { type: "section-prefs" }> =>
          b.type === "section-prefs" && b.appModule === appModule,
      );
      if (prefsBlock?.cardStyles) sectionCardStyles[appModule] = prefsBlock.cardStyles;
      sectionPrefs[appModule] = prefsBlock
        ? prefsBlock.visibleKeys
        : getDefaultVisibleKeys(appModule as AppModule);
    }

    // Gráfico Cruzado e gráficos de cada App, congelados como estão agora na tela.
    setIsCapturingCharts(true);
    let chartsSnapshot: Awaited<ReturnType<typeof captureChartsSnapshot>> | undefined;
    try {
      chartsSnapshot = await captureChartsSnapshot(
        (modules.length > 0 ? modules : ALL_MODULES).filter((moduleId): moduleId is AppModule =>
          ALL_MODULES.includes(moduleId as AppModule),
        ),
      );
    } catch (captureError) {
      console.warn("[insights] gráficos não entraram no relatório:", captureError);
    } finally {
      setIsCapturingCharts(false);
    }

    const enrichedSnapshot = {
      ...(snapshot ?? {}),
      sectionPrefs,
      sectionCardStyles,
      crossChart: chartsSnapshot?.crossChart,
      appCharts: chartsSnapshot?.appCharts ?? {},
    };

    mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      filters,
      modules,
      snapshot: enrichedSnapshot,
      aiNarrative,
      generateShareToken: makePublic,
    });
  };

  const handleClose = () => {
    setSavedToken(null);
    setName(defaultName);
    setDescription("");
    setMakePublic(true);
    onOpenChange(false);
  };

  const publicUrl = savedToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/insights/r/${savedToken}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar relatório</DialogTitle>
          <DialogDescription>
            Os dados serão congelados como snapshot — você poderá comparar com
            outros relatórios depois.
          </DialogDescription>
        </DialogHeader>

        {!savedToken ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Nome*</Label>
              <Input
                id="report-name"
                data-guide={GUIDE_ANCHORS.insightsReportName.id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Q1 2026 - Funil completo"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-desc">Descrição</Label>
              <Textarea
                id="report-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que você está analisando neste relatório?"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="public-switch" className="text-sm">
                  Link público
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite compartilhar via URL sem login
                </p>
              </div>
              <Switch
                id="public-switch"
                checked={makePublic}
                onCheckedChange={setMakePublic}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <Check className="size-5" />
              <span className="text-sm font-medium">Relatório salvo com sucesso!</span>
            </div>
            {publicUrl && (
              <div className="space-y-2">
                <Label>Link público</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl);
                      toast.success("Link copiado!");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!savedToken ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={isPending || isCapturingCharts}
                className="gap-2"
                data-guide={GUIDE_ANCHORS.insightsReportSave.id}
              >
                {isPending || isCapturingCharts ? (
                  <OrbitaSpinner className="size-4 " />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
