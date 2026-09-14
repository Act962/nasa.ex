"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  useCreateTrafegoPlan,
  useDeleteTrafegoPlan,
  useToggleTrafegoPlanActive,
  useTrafegoAdminPlans,
} from "@/features/trafego/hooks/use-trafego-admin";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVES_BY_PLATFORM,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { computeTrafegoPrice, formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { TrafegoSettingsForm } from "./settings-form";
import { TrafegoPublicLinkCard } from "./public-link-card";
import { useAdminPath } from "@/features/trafego/lib/base-path";
import { cn } from "@/lib/utils";

const CAMPAIGN_TYPES: TrafegoCampaignType[] = [
  "PROSPECCAO",
  "REMARKETING",
  "VENDA_DIRETA",
  "RECONHECIMENTO",
  "RELACIONAMENTO",
];

export function TrafegoPlansManager() {
  const { data: plans, isLoading } = useTrafegoAdminPlans();
  const toggleActive = useToggleTrafegoPlanActive();
  const deletePlan = useDeleteTrafegoPlan();
  const [isCreating, setIsCreating] = useState(false);
  const adminPath = useAdminPath();

  return (
    <div className="p-6">
      <Link
        href={adminPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Pedidos
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Planos do trafeGO</h1>
          <p className="text-sm text-muted-foreground">
            A verba vira investimento no anúncio; a taxa é a receita da NASA.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="mr-1.5 size-4" />
          Novo plano
        </Button>
      </div>

      <div className="mt-5">
        <TrafegoPublicLinkCard />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando planos…
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {plans?.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "rounded-lg border p-4",
              !plan.isActive && "opacity-60",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{plan.name}</p>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {plan.slug}
                  </span>
                  {plan.isDefault && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      destaque
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {PLATFORM_SHORT_LABEL[plan.platform]} · {plan.durationDays} dias ·{" "}
                  {plan.maxCreatives} criativos · {plan.maxCopies} copies
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.campaignTypes
                    .map((type) => CAMPAIGN_TYPE_SHORT_LABEL[type])
                    .join(", ")}
                </p>
              </div>

              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {formatBrlFromCents(plan.totalBrlCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBrlFromCents(plan.adBudgetBrlCents)} +{" "}
                  {formatBrlFromCents(plan.computedServiceFeeBrlCents)} (
                  {plan.serviceFeePercent}%)
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {plan.ordersCount} venda(s)
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  toggleActive.mutate({ planId: plan.id, isActive: !plan.isActive })
                }
              >
                <Power className="mr-1.5 size-3.5" />
                {plan.isActive ? "Desativar" : "Ativar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  deletePlan.mutate(
                    { planId: plan.id },
                    {
                      onSuccess: () => toast.success("Plano excluído."),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Excluir
              </Button>
            </div>
          </div>
        ))}

        {!isLoading && plans?.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhum plano cadastrado. Crie o primeiro para o catálogo público
            aparecer em /trafego.
          </div>
        )}
      </div>

      <div className="mt-10">
        <TrafegoSettingsForm />
      </div>

      <CreatePlanDialog open={isCreating} onOpenChange={setIsCreating} />
    </div>
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createPlan = useCreateTrafegoPlan();
  const [form, setForm] = useState({
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
  });

  const adBudgetBrlCents = Math.round(Number(form.adBudgetBrl || 0) * 100);
  const preview = computeTrafegoPrice({
    adBudgetBrlCents,
    serviceFeePercent: Number(form.serviceFeePercent || 0),
  });

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
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const availableObjectives = OBJECTIVES_BY_PLATFORM[form.platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>
            O cliente vê a verba e a taxa separadas — e paga a soma.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Impulso Essencial"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={form.slug}
                onChange={(event) =>
                  setForm({ ...form, slug: event.target.value.toLowerCase() })
                }
                placeholder="impulso-essencial"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Chamada</Label>
            <Input
              value={form.headline}
              onChange={(event) => setForm({ ...form, headline: event.target.value })}
              placeholder="Para começar a aparecer na região"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Canal</Label>
            <Select
              value={form.platform}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  platform: value as TrafegoPlatform,
                  objectives: OBJECTIVES_BY_PLATFORM[value as TrafegoPlatform].slice(0, 1),
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_SHORT_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Tipos de campanha atendidos</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAMPAIGN_TYPES.map((type) => {
                const isOn = form.campaignTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        campaignTypes: isOn
                          ? form.campaignTypes.filter((item) => item !== type)
                          : [...form.campaignTypes, type],
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      isOn
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {CAMPAIGN_TYPE_SHORT_LABEL[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">Objetivos atendidos</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {availableObjectives.map((objective) => {
                const isOn = form.objectives.includes(objective);
                return (
                  <button
                    key={objective}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        objectives: isOn
                          ? form.objectives.filter((item) => item !== objective)
                          : [...form.objectives, objective],
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      isOn
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {OBJECTIVE_LABEL[objective]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Verba de tráfego (R$)</Label>
              <Input
                type="number"
                value={form.adBudgetBrl}
                onChange={(event) =>
                  setForm({ ...form, adBudgetBrl: event.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Taxa de serviço (%)</Label>
              <Input
                type="number"
                value={form.serviceFeePercent}
                onChange={(event) =>
                  setForm({ ...form, serviceFeePercent: event.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Duração (dias)</Label>
              <Input
                type="number"
                value={form.durationDays}
                onChange={(event) =>
                  setForm({ ...form, durationDays: event.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Máx. criativos</Label>
              <Input
                type="number"
                value={form.maxCreatives}
                onChange={(event) =>
                  setForm({ ...form, maxCreatives: event.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Máx. copies</Label>
              <Input
                type="number"
                value={form.maxCopies}
                onChange={(event) =>
                  setForm({ ...form, maxCopies: event.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Benefícios (um por linha)</Label>
            <Textarea
              value={form.highlights}
              onChange={(event) => setForm({ ...form, highlights: event.target.value })}
              rows={4}
              placeholder={"Segmentação feita por especialista\nRelatório de desempenho\nSuporte pelo painel"}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.isDefault}
              onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
            />
            <Label className="text-xs">Destacar como &quot;mais escolhido&quot;</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createPlan.isPending}>
            {createPlan.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
