"use client";

import { useState } from "react";
import { CirclePlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryWithoutWidgetTags } from "@/features/tags/hooks/use-tags";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import {
  APP_METRIC_LABELS,
  APP_METRIC_SOURCES,
  APP_METRICS,
  type AppMetricSource,
} from "@/lib/insights/app-metrics";
import { ALL_MODULES, type AppModule } from "@/features/insights/types";
import { toast } from "sonner";

interface AddInsightButtonProps {
  organizationIds: string[];
  variant?: "card" | "button";
}

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function AddInsightButton({
  organizationIds,
  variant = "card",
}: AddInsightButtonProps) {
  const { canEdit, addBlock } = useOrgLayout();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"tag" | "app-metric" | "custom-chart">("tag");

  if (!canEdit) {
    return null;
  }

  const Trigger =
    variant === "card" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 hover:bg-foreground/10 rounded-md cursor-pointer transition-all duration-100 py-10 w-full"
      >
        <CirclePlusIcon className="size-10" />
        <span className="text-sm font-medium">Adicionar Insight</span>
      </button>
    ) : (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CirclePlusIcon className="size-4 mr-2" />
        Adicionar Insight
      </Button>
    );

  return (
    <>
      {Trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Insight</DialogTitle>
            <DialogDescription>
              Escolha o tipo de bloco para incluir no painel da empresa.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="tag">Tag</TabsTrigger>
              <TabsTrigger value="app-metric">Métrica de App</TabsTrigger>
              <TabsTrigger value="custom-chart">Gráfico</TabsTrigger>
            </TabsList>

            <TabsContent value="tag" className="pt-4">
              <TagTab
                organizationIds={organizationIds}
                onAdd={(tagId, title) => {
                  addBlock({
                    id: genId("tag"),
                    type: "tag-tile",
                    order: 0,
                    tagId,
                    title,
                  });
                  toast.success("Tag adicionada ao painel");
                  setOpen(false);
                }}
              />
            </TabsContent>

            <TabsContent value="app-metric" className="pt-4">
              <AppMetricTab
                onAdd={(appSlug, metricKey, label, pinnedToApps) => {
                  addBlock({
                    id: genId("metric"),
                    type: "app-metric",
                    order: 0,
                    appSlug,
                    metricKey,
                    label,
                    pinnedToApps,
                  });
                  toast.success("Métrica adicionada ao painel");
                  setOpen(false);
                }}
              />
            </TabsContent>

            <TabsContent value="custom-chart" className="pt-4">
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Use o card de Gráfico Personalizado acima do painel para criar
                novas séries. Os gráficos são listados automaticamente.
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TagTab({
  organizationIds,
  onAdd,
}: {
  organizationIds: string[];
  onAdd: (tagId: string, title: string) => void;
}) {
  const { tags } = useQueryWithoutWidgetTags({ organizationIds });
  const [tagId, setTagId] = useState<string>("");

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tag</Label>
        <Select value={tagId} onValueChange={setTagId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma tag" />
          </SelectTrigger>
          <SelectContent>
            {tags && tags.length > 0 ? (
              tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhuma tag disponível
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="w-full"
        disabled={!tagId}
        onClick={() => {
          const t = tags?.find((x) => x.id === tagId);
          if (!t) return;
          onAdd(t.id, t.name);
        }}
      >
        Adicionar tag
      </Button>
    </div>
  );
}

function AppMetricTab({
  onAdd,
}: {
  onAdd: (
    appSlug: AppMetricSource,
    metricKey: string,
    label: string | undefined,
    pinnedToApps: AppModule[] | undefined,
  ) => void;
}) {
  const [appSlug, setAppSlug] = useState<AppMetricSource | "">("");
  const [metricKey, setMetricKey] = useState<string>("");
  const [pinSelf, setPinSelf] = useState(false);
  const [extraPins, setExtraPins] = useState<AppModule[]>([]);

  const metricOptions = appSlug ? APP_METRICS[appSlug] : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>App</Label>
          <Select
            value={appSlug}
            onValueChange={(v) => {
              setAppSlug(v as AppMetricSource);
              setMetricKey("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha o app" />
            </SelectTrigger>
            <SelectContent>
              {APP_METRIC_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {APP_METRIC_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Métrica</Label>
          <Select
            value={metricKey}
            onValueChange={setMetricKey}
            disabled={!appSlug}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha a métrica" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {appSlug && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="pin-self"
              checked={pinSelf}
              onCheckedChange={(v) => setPinSelf(Boolean(v))}
            />
            <Label htmlFor="pin-self" className="text-sm cursor-pointer">
              Visualizar no app{" "}
              <strong>{APP_METRIC_LABELS[appSlug]}</strong>
            </Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Visualizar também em outros apps
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_MODULES.filter((m) => m !== (appSlug as string)).map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <Checkbox
                    checked={extraPins.includes(m)}
                    onCheckedChange={(v) => {
                      setExtraPins((cur) =>
                        v ? [...cur, m] : cur.filter((x) => x !== m),
                      );
                    }}
                  />
                  <span className="capitalize">{m.replace("-", " ")}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!appSlug || !metricKey}
        onClick={() => {
          if (!appSlug || !metricKey) return;
          const def = APP_METRICS[appSlug].find((m) => m.key === metricKey);
          const pinnedToApps: AppModule[] = [
            ...(pinSelf ? [appSlug as AppModule] : []),
            ...extraPins,
          ];
          onAdd(
            appSlug,
            metricKey,
            def?.label,
            pinnedToApps.length > 0 ? pinnedToApps : undefined,
          );
        }}
      >
        Adicionar métrica
      </Button>
    </div>
  );
}
