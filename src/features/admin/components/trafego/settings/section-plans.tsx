"use client";

import { useState } from "react";
import { Loader2, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDeleteTrafegoPlan,
  useToggleTrafegoPlanActive,
  useTrafegoAdminPlans,
} from "@/features/trafego/hooks/use-trafego-admin";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import type {
  TrafegoSettingsFormState,
  TrafegoSettingsPatch,
} from "@/features/admin/lib/trafego-settings-form";
import { CreatePlanDialog } from "./create-plan-dialog";
import {
  SettingsCard,
  SettingsField,
  SettingsGrid,
} from "./settings-primitives";
import { cn } from "@/lib/utils";

export function PlansSection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  const { data: plans, isLoading } = useTrafegoAdminPlans();
  const toggleActive = useToggleTrafegoPlanActive();
  const deletePlan = useDeleteTrafegoPlan();
  const [isCreating, setIsCreating] = useState(false);
  const [planPendingDeletion, setPlanPendingDeletion] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Valores padrão"
        description="Usados quando o plano não define o seu. A verba vira investimento no anúncio; a taxa é a receita da NASA."
      >
        <SettingsGrid>
          <SettingsField
            label="Taxa de serviço padrão (%)"
            hint="Aceita fração, como 47,5."
          >
            <Input
              type="number"
              min={0}
              max={1000}
              step="0.5"
              value={form.defaultServiceFeePercent}
              onChange={(event) =>
                patch({ defaultServiceFeePercent: event.target.value })
              }
            />
          </SettingsField>

          <SettingsField
            label="Criativos incluídos"
            hint="Quantas peças o cliente manda sem custo extra (1 a 20)."
          >
            <Input
              type="number"
              min={1}
              max={20}
              value={form.includedCreatives}
              onChange={(event) =>
                patch({ includedCreatives: event.target.value })
              }
            />
          </SettingsField>

          <SettingsField
            label="Criativo extra (R$)"
            hint="Cobrado por peça acima do incluído."
          >
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.extraCreativeBrl}
              onChange={(event) =>
                patch({ extraCreativeBrl: event.target.value })
              }
            />
          </SettingsField>
        </SettingsGrid>
      </SettingsCard>

      <SettingsCard
        title="Planos publicados"
        description="O catálogo que aparece em /trafego. Plano desativado some da vitrine mas mantém o histórico de vendas."
        action={
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="mr-1.5 size-4" />
            Novo plano
          </Button>
        }
      >
        {isLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando planos…
          </div>
        )}

        {!isLoading && plans?.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum plano cadastrado. Crie o primeiro para o catálogo público
            aparecer em /trafego.
          </div>
        )}

        <div className="grid gap-2.5">
          {plans?.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border px-4 py-3",
                !plan.isActive && "bg-muted/30",
              )}
            >
              <div className="min-w-56 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      !plan.isActive && "text-muted-foreground",
                    )}
                  >
                    {plan.name}
                  </p>
                  {plan.isDefault && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      destaque
                    </span>
                  )}
                  {!plan.isActive && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      desativado
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {PLATFORM_SHORT_LABEL[plan.platform]} · {plan.durationDays}{" "}
                  dias · {plan.maxCreatives} criativos · {plan.maxCopies} copies
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {plan.campaignTypes
                    .map((type) => CAMPAIGN_TYPE_SHORT_LABEL[type])
                    .join(", ")}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatBrlFromCents(plan.totalBrlCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBrlFromCents(plan.adBudgetBrlCents)} verba +{" "}
                  {formatBrlFromCents(plan.computedServiceFeeBrlCents)} taxa
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.ordersCount} venda(s)
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toggleActive.mutate({
                      planId: plan.id,
                      isActive: !plan.isActive,
                    })
                  }
                >
                  <Power className="mr-1.5 size-3.5" />
                  {plan.isActive ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${plan.name}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setPlanPendingDeletion({ id: plan.id, name: plan.name })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <CreatePlanDialog open={isCreating} onOpenChange={setIsCreating} />

      <AlertDialog
        open={Boolean(planPendingDeletion)}
        onOpenChange={(open) => !open && setPlanPendingDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {planPendingDeletion?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O plano sai do catálogo público e não pode ser recuperado. Se a
              ideia é só tirar da vitrine, use Desativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!planPendingDeletion) return;
                deletePlan.mutate(
                  { planId: planPendingDeletion.id },
                  {
                    onSuccess: () => toast.success("Plano excluído."),
                    onError: (error) => toast.error(error.message),
                  },
                );
                setPlanPendingDeletion(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
