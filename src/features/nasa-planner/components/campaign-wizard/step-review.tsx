"use client";

import { BuildingIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CampaignPlanDraft, WizardProject } from "./wizard-options";

/** Passo 5 do assistente de campanha: resumo antes de concluir. */

interface StepReviewProps {
  plan: CampaignPlanDraft;
  selectedOrgName: string;
  selectedProject: WizardProject | undefined;
  eventCount: number;
  assetCount: number;
  taskCount: number;
}

export function StepReview({ plan, selectedOrgName, selectedProject, eventCount, assetCount, taskCount }: StepReviewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold">{plan.title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BuildingIcon className="size-3.5" />
          <span>{selectedOrgName}</span>
          {selectedProject && (
            <>
              <span>·</span>
              <div className="size-2.5 rounded-full" style={{ backgroundColor: selectedProject.color ?? "#7c3aed" }} />
              <span>{selectedProject.name}</span>
            </>
          )}
        </div>
        {(plan.startDate || plan.endDate) && (
          <p className="text-sm">{plan.startDate && new Date(plan.startDate).toLocaleDateString("pt-BR")} {plan.endDate && `→ ${new Date(plan.endDate).toLocaleDateString("pt-BR")}`}</p>
        )}
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline">{eventCount} ações</Badge>
          <Badge variant="outline">{assetCount} materiais</Badge>
          <Badge variant="outline">{taskCount} sub-ações</Badge>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Os dados serão salvos e você poderá adicionar mais informações no painel do planejamento.
      </div>
    </div>
  );
}
