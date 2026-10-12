"use client";

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { ListIcon, NetworkIcon } from "lucide-react";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { cn } from "@/lib/utils";

export type WorkflowsView = "list" | "map";

/** Como a página de Gatilhos Automáticos do funil mostra os fluxos. Escolha de cada pessoa, guardada no navegador. */
export const workflowsViewAtom = atomWithStorage<WorkflowsView>("orbita:workflows-view", "map");

const VIEWS = [
  { value: "list" as const, label: "Lista", icon: ListIcon, title: "Um fluxo por linha" },
  { value: "map" as const, label: "Mapa", icon: NetworkIcon, title: "Todos os fluxos numa tela só, com os passos à vista" },
];

/** Chave "Lista / Mapa" da página de fluxos do funil (spec 0092). */
export function WorkflowsViewToggle() {
  const [workflowsView, setWorkflowsView] = useAtom(workflowsViewAtom);
  return (
    <div className="flex h-8 overflow-hidden rounded-full border bg-background text-xs" data-guide={GUIDE_ANCHORS.workflowsViewToggle.id}>
      {VIEWS.map((view) => (
        <button
          key={view.value}
          type="button"
          title={view.title}
          aria-pressed={workflowsView === view.value}
          onClick={() => setWorkflowsView(view.value)}
          className={cn(
            "flex h-full items-center gap-1.5 px-3 transition",
            workflowsView === view.value ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <view.icon className="size-3.5" />
          {view.label}
        </button>
      ))}
    </div>
  );
}
