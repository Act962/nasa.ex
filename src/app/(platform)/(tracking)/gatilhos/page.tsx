"use client";

import { PlusIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AstroFlowBar } from "@/features/automations-hub/components/astro-flow-bar";
import { AutomationsList } from "@/features/automations-hub/components/automations-list";
import { LastTrackingFlowsButton } from "@/features/automations-hub/components/last-tracking-flows-button";
import { useAutomationsHubStore } from "@/features/automations-hub/store";

// Página da central de Gatilhos Automáticos (spec 0090, RF-2): a lista completa das automações
// da empresa. Criar abre a mesma janela usada no resto da plataforma.

export default function GatilhosPage() {
  const openHub = useAutomationsHubStore((state) => state.open);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ZapIcon className="size-5" />
            Gatilhos Automáticos
          </h1>
          <p className="text-sm text-muted-foreground">
            As automações da empresa em um lugar: o que está ligado, o que tem problema e onde criar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LastTrackingFlowsButton />
          <AstroFlowBar />
          <Button onClick={() => openHub("new")}>
            <PlusIcon />
            Criar
          </Button>
        </div>
      </div>
      <AutomationsList />
    </div>
  );
}
