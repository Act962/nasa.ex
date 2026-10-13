"use client";

import { StarIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPAIGN_TYPES, type CampaignPlanDraft } from "./wizard-options";

/** Passo 1 do assistente de campanha: tipo, nome, objetivos, período e cor. */

interface StepPlanProps {
  plan: CampaignPlanDraft;
  isGeneratingBrief: boolean;
  onPlanChange: (patch: Partial<CampaignPlanDraft>) => void;
  onGenerateBrief: () => void;
}

export function StepPlan({ plan, isGeneratingBrief, onPlanChange, onGenerateBrief }: StepPlanProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-warning bg-warning/15 px-3 py-2 rounded-lg">
        <StarIcon className="size-4 fill-warning text-warning" />
        Esta ação consome <strong>1 STAR</strong>
      </div>

      {/* Campaign type */}
      <div className="space-y-1.5">
        <Label>Tipo de Campanha *</Label>
        <Select value={plan.campaignType} onValueChange={(campaignType) => onPlanChange({ campaignType })}>
          <SelectTrigger><SelectValue placeholder="Escolha o tipo de campanha..." /></SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Nome do Planejamento *</Label>
        <Input placeholder="Ex: Campanha Q2 2026 — Lançamento" value={plan.title} onChange={(e) => onPlanChange({ title: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Objetivos, contexto e metas</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs text-info border-info/30 hover:bg-info/15"
            disabled={!plan.campaignType || isGeneratingBrief}
            onClick={onGenerateBrief}
          >
            <SparklesIcon className="size-3.5" />
            {isGeneratingBrief ? "Gerando..." : "Gerar com ASTRO"}
          </Button>
        </div>
        <Textarea
          placeholder={plan.campaignType ? "Clique em 'Gerar com ASTRO' ou escreva manualmente..." : "Selecione o tipo de campanha para gerar automaticamente..."}
          rows={5}
          value={plan.description}
          onChange={(e) => onPlanChange({ description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Data de Início</Label>
          <Input type="date" value={plan.startDate} onChange={(e) => onPlanChange({ startDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Data de Fim</Label>
          <Input type="date" value={plan.endDate} onChange={(e) => onPlanChange({ endDate: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Cor da Campanha</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={plan.color} onChange={(e) => onPlanChange({ color: e.target.value })} className="h-9 w-16 cursor-pointer rounded border" />
          <span className="text-sm text-muted-foreground">{plan.color}</span>
        </div>
      </div>
    </div>
  );
}
