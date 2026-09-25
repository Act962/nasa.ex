"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import { useCreateTrafegoPlan } from "@/features/trafego/hooks/use-trafego-admin";
import {
  CAMPAIGN_TYPES_BY_PLATFORM,
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVES_BY_PLATFORM,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import {
  computeTrafegoPrice,
  formatBrlFromCents,
} from "@/features/trafego/lib/pricing";
import { SettingsDivider, SettingsField, SettingsGrid } from "./settings-primitives";
import { cn } from "@/lib/utils";

const PLATFORMS = Object.keys(PLATFORM_SHORT_LABEL) as TrafegoPlatform[];

export function CreatePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createPlan = useCreateTrafegoPlan();
  const [form, setForm] = useState(emptyPlanForm);

  const adBudgetBrlCents = Math.round(Number(form.adBudgetBrl || 0) * 100);
  const preview = computeTrafegoPrice({
    adBudgetBrlCents,
    serviceFeePercent: Number(form.serviceFeePercent || 0),
  });

  const availableObjectives = OBJECTIVES_BY_PLATFORM[form.platform];
  const availableCampaignTypes = CAMPAIGN_TYPES_BY_PLATFORM[form.platform];
  const isValid =
    form.name.trim().length > 1 &&
    form.slug.trim().length > 1 &&
    form.campaignTypes.length > 0 &&
    form.objectives.length > 0 &&
    adBudgetBrlCents > 0;

  function patch(partial: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function handlePlatformChange(platform: TrafegoPlatform) {
    // Objetivos e tipos são por canal: manter a seleção anterior gravaria um
    // plano oferecendo algo que o canal não atende.
    patch({
      platform,
      objectives: OBJECTIVES_BY_PLATFORM[platform].slice(0, 1),
      campaignTypes: CAMPAIGN_TYPES_BY_PLATFORM[platform].slice(0, 1),
    });
  }

  function handleCreate() {
    createPlan.mutate(
      {
        slug: form.slug.trim(),
        name: form.name.trim(),
        headline: form.headline.trim() || undefined,
        description: form.description.trim() || undefined,
        platform: form.platform,
        campaignTypes: form.campaignTypes,
        objectives: form.objectives,
        adBudgetBrlCents,
        serviceFeePercent: Number(form.serviceFeePercent),
        serviceFeeBrlCents: null,
        durationDays: Number(form.durationDays),
        maxCreatives: Number(form.maxCreatives),
        maxCopies: Number(form.maxCopies),
        highlights: form.highlights
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        isActive: true,
        isDefault: form.isDefault,
        position: 0,
      },
      {
        onSuccess: () => {
          toast.success("Plano criado.");
          setForm(emptyPlanForm);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>
            O cliente vê a verba e a taxa separadas — e paga a soma.
          </DialogDescription>
        </DialogHeader>

        <SettingsGrid>
          <SettingsField label="Nome">
            <Input
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                patch({
                  name,
                  slug: form.isSlugManual ? form.slug : slugify(name),
                });
              }}
              placeholder="Impulso Essencial"
            />
          </SettingsField>

          <SettingsField label="Slug" hint="Identificador na URL e no catálogo.">
            <Input
              value={form.slug}
              onChange={(event) =>
                patch({
                  slug: normalizeSlugInput(event.target.value),
                  isSlugManual: true,
                })
              }
              placeholder="impulso-essencial"
            />
          </SettingsField>

          <SettingsField label="Chamada" wide>
            <Input
              value={form.headline}
              onChange={(event) => patch({ headline: event.target.value })}
              placeholder="Para começar a aparecer na região"
            />
          </SettingsField>

          <SettingsField label="Descrição" wide>
            <Textarea
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              rows={2}
              placeholder="Explique em uma frase para quem é este plano."
            />
          </SettingsField>

          <SettingsDivider title="Cobertura" />

          <SettingsField label="Canal" wide>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((platform) => (
                <ChoiceChip
                  key={platform}
                  isOn={form.platform === platform}
                  onClick={() => handlePlatformChange(platform)}
                >
                  {PLATFORM_SHORT_LABEL[platform]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>

          <SettingsField label="Tipos de campanha atendidos" wide>
            <div className="flex flex-wrap gap-1.5">
              {availableCampaignTypes.map((type) => (
                <ChoiceChip
                  key={type}
                  isOn={form.campaignTypes.includes(type)}
                  onClick={() =>
                    patch({ campaignTypes: toggle(form.campaignTypes, type) })
                  }
                >
                  {CAMPAIGN_TYPE_SHORT_LABEL[type]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>

          <SettingsField label="Objetivos atendidos" wide>
            <div className="flex flex-wrap gap-1.5">
              {availableObjectives.map((objective) => (
                <ChoiceChip
                  key={objective}
                  isOn={form.objectives.includes(objective)}
                  onClick={() =>
                    patch({ objectives: toggle(form.objectives, objective) })
                  }
                >
                  {OBJECTIVE_LABEL[objective]}
                </ChoiceChip>
              ))}
            </div>
          </SettingsField>

          <SettingsDivider title="Preço" />

          <SettingsField label="Verba de tráfego (R$)">
            <Input
              type="number"
              min={0}
              value={form.adBudgetBrl}
              onChange={(event) => patch({ adBudgetBrl: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Taxa de serviço (%)">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={form.serviceFeePercent}
              onChange={(event) =>
                patch({ serviceFeePercent: event.target.value })
              }
            />
          </SettingsField>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm sm:col-span-2">
            <div className="flex justify-between text-muted-foreground">
              <span>Verba</span>
              <span className="tabular-nums">
                {formatBrlFromCents(preview.adBudgetBrlCents)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>Taxa</span>
              <span className="tabular-nums">
                {formatBrlFromCents(preview.serviceFeeBrlCents)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Cliente paga</span>
              <span className="tabular-nums">
                {formatBrlFromCents(preview.totalBrlCents)}
              </span>
            </div>
          </div>

          <SettingsDivider title="Entregáveis" />

          <SettingsField label="Duração (dias)">
            <Input
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(event) => patch({ durationDays: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Máx. criativos">
            <Input
              type="number"
              min={1}
              value={form.maxCreatives}
              onChange={(event) => patch({ maxCreatives: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Máx. copies">
            <Input
              type="number"
              min={1}
              value={form.maxCopies}
              onChange={(event) => patch({ maxCopies: event.target.value })}
            />
          </SettingsField>

          <SettingsField label="Benefícios (um por linha)" wide>
            <Textarea
              value={form.highlights}
              onChange={(event) => patch({ highlights: event.target.value })}
              rows={4}
              placeholder={
                "Segmentação feita por especialista\nRelatório de desempenho\nSuporte pelo painel"
              }
            />
          </SettingsField>

          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <Switch
              checked={form.isDefault}
              onCheckedChange={(isDefault) => patch({ isDefault })}
            />
            Destacar como &quot;mais escolhido&quot;
          </label>
        </SettingsGrid>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || createPlan.isPending}
          >
            {createPlan.isPending && (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            )}
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const emptyPlanForm = {
  slug: "",
  name: "",
  headline: "",
  description: "",
  platform: "META_ADS" as TrafegoPlatform,
  campaignTypes: ["PROSPECCAO"] as TrafegoCampaignType[],
  objectives: ["LEADS"] as TrafegoObjective[],
  adBudgetBrl: "500",
  serviceFeePercent: "50",
  durationDays: "30",
  maxCreatives: "3",
  maxCopies: "3",
  highlights: "",
  isDefault: false,
  isSlugManual: false,
};

function ChoiceChip({
  isOn,
  onClick,
  children,
}: {
  isOn: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isOn}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition",
        isOn
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item)
    ? list.filter((current) => current !== item)
    : [...list, item];
}

/** Digitação livre: não corta hífens das pontas, senão não dá para escrever. */
function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-");
}

function slugify(value: string): string {
  return normalizeSlugInput(value).replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
