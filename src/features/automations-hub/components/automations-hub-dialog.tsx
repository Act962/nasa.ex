"use client";

import { useState } from "react";
import Link from "next/link";
import { ZapIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickWorkflowBuilder } from "@/features/workflows/components/quick-builder/quick-workflow-builder";
import { cn } from "@/lib/utils";
import { useAutomationsOverview } from "../hooks/use-automations-hub";
import { useAutomationsHubStore, type AutomationsHubTab } from "../store";
import { AutomationsList } from "./automations-list";

// Janela da central (spec 0090, RF-1): o construtor rápido que já existe ("Novo gatilho"),
// com a escolha do funil e a aba do que está ativo na empresa.

const TABS: { value: AutomationsHubTab; label: string }[] = [
  { value: "new", label: "Novo" },
  { value: "active", label: "Ativos" },
];
const ROWS_IN_DIALOG = 8;

export function AutomationsHubDialog() {
  const { isOpen, tab, close, setTab } = useAutomationsHubStore();
  const { data } = useAutomationsOverview({ enabled: isOpen });
  const [chosenTrackingId, setChosenTrackingId] = useState<string | null>(null);
  const trackings = data?.trackings ?? [];
  const trackingId = chosenTrackingId ?? trackings[0]?.id ?? null;
  const activeCount = (data?.automations ?? []).filter((automation) => automation.isActive).length;

  return (
    <Dialog open={isOpen} onOpenChange={(isDialogOpen) => !isDialogOpen && close()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ZapIcon className="size-4" />
            Gatilhos Automáticos
          </DialogTitle>
          <DialogDescription>
            {tab === "new" ? "Descreva numa frase ou monte passo a passo." : "Tudo o que a empresa tem de automação, em um lugar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((tabOption) => (
            <button
              key={tabOption.value}
              type="button"
              onClick={() => setTab(tabOption.value)}
              className={cn(
                "rounded-full border px-3.5 py-1 text-sm transition",
                tab === tabOption.value ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tabOption.label}
              {tabOption.value === "active" && data ? ` · ${activeCount}` : ""}
            </button>
          ))}
          {tab === "new" && trackings.length > 1 && trackingId && (
            <Select value={trackingId} onValueChange={setChosenTrackingId}>
              <SelectTrigger size="sm" className="ml-auto h-8 w-auto max-w-56 text-xs">
                <SelectValue placeholder="Funil" />
              </SelectTrigger>
              <SelectContent>
                {trackings.map((tracking) => (
                  <SelectItem key={tracking.id} value={tracking.id}>
                    {tracking.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {tab === "new" &&
          (trackingId && data?.canCreateTrackingFlow ? (
            // A chave recria o construtor ao trocar de funil: tags e etapas são de cada um.
            <QuickWorkflowBuilder key={trackingId} trackingId={trackingId} onCreated={close} />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {data && !data.canCreateTrackingFlow
                ? "Você não tem permissão para criar automações. Fale com o administrador do Órbita."
                : "Crie um tracking para começar a montar gatilhos."}
            </p>
          ))}

        {tab === "active" && (
          <>
            <AutomationsList onNavigate={close} maxRows={ROWS_IN_DIALOG} />
            <Link href="/gatilhos" onClick={close} className="block text-center text-sm font-semibold text-primary hover:underline">
              Abrir a página completa →
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
