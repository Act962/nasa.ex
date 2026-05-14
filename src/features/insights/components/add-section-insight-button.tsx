"use client";

import { useMemo, useState } from "react";
import { PlusIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  getMetricsForApp,
  getDefaultVisibleKeys,
} from "@/features/insights/lib/insights-metric-catalog";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import type { AppModule } from "@/features/insights/types";
import type { InsightBlock } from "@/features/insights/lib/app-metrics";

interface AddSectionInsightButtonProps {
  appModule: AppModule;
}

/**
 * Botão "+ Adicionar Insight" da seção do app no dashboard.
 * - Visível só pra `canEdit` (owner/moderador).
 * - Abre um Sheet listando todas as métricas do app (catálogo).
 * - Checkbox por linha controla visibilidade.
 * - Persiste via `section-prefs` block do `OrganizationInsightLayout`.
 */
export function AddSectionInsightButton({
  appModule,
}: AddSectionInsightButtonProps) {
  const { canEdit, blocks, addBlock, updateBlock } = useOrgLayout();
  const [open, setOpen] = useState(false);

  // Acha o block `section-prefs` desta seção (se existir)
  const prefsBlock = useMemo(() => {
    return blocks.find(
      (b): b is Extract<InsightBlock, { type: "section-prefs" }> =>
        b.type === "section-prefs" && b.appModule === appModule,
    );
  }, [blocks, appModule]);

  const availableMetrics = useMemo(
    () => getMetricsForApp(appModule),
    [appModule],
  );

  // Set efetivo de keys visíveis — vem do block se existir, senão dos
  // defaults do catálogo.
  const visibleKeys = useMemo(() => {
    if (prefsBlock) return new Set(prefsBlock.visibleKeys);
    return new Set(getDefaultVisibleKeys(appModule));
  }, [prefsBlock, appModule]);

  const toggleKey = (key: string) => {
    const next = new Set(visibleKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    if (prefsBlock) {
      updateBlock(prefsBlock.id, { visibleKeys: Array.from(next) });
    } else {
      addBlock({
        id: `section-prefs-${appModule}-${Date.now()}`,
        type: "section-prefs",
        order: blocks.length,
        appModule,
        visibleKeys: Array.from(next),
      });
    }
  };

  const resetToDefault = () => {
    const defaults = getDefaultVisibleKeys(appModule);
    if (prefsBlock) {
      updateBlock(prefsBlock.id, { visibleKeys: defaults });
    } else {
      addBlock({
        id: `section-prefs-${appModule}-${Date.now()}`,
        type: "section-prefs",
        order: blocks.length,
        appModule,
        visibleKeys: defaults,
      });
    }
  };

  if (!canEdit) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <PlusIcon className="size-3.5" />
          <span>Adicionar Insight</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 shrink-0">
          <SheetTitle>Indicadores da seção</SheetTitle>
          <SheetDescription>
            Marque os KPIs que devem aparecer pra todos da empresa.
            Desmarque pra ocultar.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="space-y-1.5 py-4">
            {availableMetrics.map((metric) => {
              const Icon = metric.icon;
              const checked = visibleKeys.has(metric.key);
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => toggleKey(metric.key)}
                  className={cn(
                    "flex items-start gap-3 w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/30",
                    checked && "border-primary/40 bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "size-9 rounded-md flex items-center justify-center shrink-0",
                      metric.bg,
                    )}
                  >
                    <Icon className={cn("size-4", metric.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{metric.label}</div>
                    {metric.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {metric.description}
                      </p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="size-4 mt-1 accent-primary pointer-events-none"
                    aria-label={`${checked ? "Ocultar" : "Mostrar"} ${metric.label}`}
                  />
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-4 shrink-0">
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={resetToDefault}
          >
            <RotateCcwIcon className="size-3.5" />
            Restaurar padrão
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
