"use client";

import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useProvisionTrafegoBriefingForm,
  useProvisionTrafegoOperationsTracking,
  useTrafegoAgencyOptions,
} from "@/features/trafego/hooks/use-trafego-admin";
import { TRAFEGO_KANBAN_COLUMNS } from "@/features/trafego/lib/kanban-columns";
import type {
  TrafegoSettingsFormState,
  TrafegoSettingsPatch,
} from "@/features/admin/lib/trafego-settings-form";
import { SettingsCombobox } from "./settings-combobox";
import {
  SettingsCard,
  SettingsField,
  SettingsGrid,
  SettingsNotice,
} from "./settings-primitives";
import { cn } from "@/lib/utils";

export function OperationsSection({
  form,
  patch,
}: {
  form: TrafegoSettingsFormState;
  patch: TrafegoSettingsPatch;
}) {
  const { data: options, isLoading: isLoadingOptions } = useTrafegoAgencyOptions(
    form.agencyOrganizationId,
  );
  const provisionTracking = useProvisionTrafegoOperationsTracking();
  const provisionForm = useProvisionTrafegoBriefingForm();

  const hasAgency = Boolean(form.agencyOrganizationId.trim());
  const selectedTracking = options?.trackings.find(
    (tracking) => tracking.id === form.operationsTrackingId,
  );
  const mappedCount = TRAFEGO_KANBAN_COLUMNS.filter(
    (column) => form.statusColumnMap[column.key],
  ).length;

  function handleProvisionTracking() {
    provisionTracking.mutate(
      { organizationId: form.agencyOrganizationId.trim() || undefined },
      {
        onSuccess: (result) => {
          patch({
            operationsTrackingId: result.trackingId,
            statusColumnMap: result.statusColumnMap as Record<string, string>,
          });
          toast.success(
            result.created
              ? "Tracking TrafeGO criado com as 12 colunas."
              : "Colunas conferidas e mapa refeito.",
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleProvisionForm() {
    provisionForm.mutate(
      { organizationId: form.agencyOrganizationId.trim() || undefined },
      {
        onSuccess: (result) => {
          patch({ briefingFormId: result.formId });
          toast.success(
            result.created
              ? "Formulário Briefing TrafeGO criado."
              : "Formulário já existia.",
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Board da operação"
        description="Onde o gestor trabalha: um card por cliente, uma coluna por fase. Arrastar o card muda o status do pedido e avisa o cliente."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasAgency || provisionTracking.isPending}
            onClick={handleProvisionTracking}
          >
            {provisionTracking.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 size-4" />
            )}
            {form.operationsTrackingId
              ? "Conferir colunas"
              : "Criar tracking TrafeGO"}
          </Button>
        }
      >
        <SettingsGrid>
          <SettingsField label="Tracking de operação" wide>
            <SettingsCombobox
              value={form.operationsTrackingId}
              onChange={(operationsTrackingId) =>
                patch({ operationsTrackingId, statusColumnMap: {} })
              }
              items={(options?.trackings ?? []).map((tracking) => ({
                value: tracking.id,
                label: tracking.name,
              }))}
              placeholder={
                hasAgency
                  ? "Escolha o tracking"
                  : "Escolha a organização da agência primeiro"
              }
              searchPlaceholder="Buscar tracking"
              emptyLabel="Nenhum tracking nesta organização."
              disabled={!hasAgency}
              isLoading={isLoadingOptions}
            />
          </SettingsField>

          {!hasAgency && (
            <SettingsNotice tone="info">
              Escolha a organização da agência em <strong>Agência e leads</strong>{" "}
              para liberar estas opções.
            </SettingsNotice>
          )}

          {selectedTracking && (
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">
                  Fase do pedido → coluna do tracking
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    mappedCount === TRAFEGO_KANBAN_COLUMNS.length
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {mappedCount} de {TRAFEGO_KANBAN_COLUMNS.length} mapeadas
                </span>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {TRAFEGO_KANBAN_COLUMNS.map((column) => {
                  const mappedStatusId = form.statusColumnMap[column.key] ?? "";
                  return (
                    <div
                      key={column.key}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2",
                        !mappedStatusId && "border-dashed border-amber-500/40",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {column.name}
                      </span>
                      <div className="w-44 shrink-0">
                        <SettingsCombobox
                          compact
                          value={mappedStatusId}
                          onChange={(statusId) =>
                            patch({
                              statusColumnMap: statusId
                                ? {
                                    ...form.statusColumnMap,
                                    [column.key]: statusId,
                                  }
                                : Object.fromEntries(
                                    Object.entries(form.statusColumnMap).filter(
                                      ([key]) => key !== column.key,
                                    ),
                                  ),
                            })
                          }
                          items={selectedTracking.status.map((status) => ({
                            value: status.id,
                            label: status.name,
                            color: status.color ?? undefined,
                          }))}
                          placeholder="Sem coluna"
                          searchPlaceholder="Buscar coluna"
                          emptyLabel="Este tracking não tem colunas."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SettingsGrid>
      </SettingsCard>

      <SettingsCard
        title="Briefing no card"
        description="As respostas do wizard viram uma resposta deste formulário no card do lead."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasAgency || provisionForm.isPending}
            onClick={handleProvisionForm}
          >
            {provisionForm.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 size-4" />
            )}
            Criar formulário
          </Button>
        }
      >
        <SettingsGrid>
          <SettingsField label="Formulário de briefing" wide>
            <SettingsCombobox
              value={form.briefingFormId}
              onChange={(briefingFormId) => patch({ briefingFormId })}
              items={(options?.forms ?? []).map((formOption) => ({
                value: formOption.id,
                label: formOption.name,
                hint: formOption.published ? undefined : "não publicado",
              }))}
              placeholder={
                hasAgency
                  ? "Escolha o formulário"
                  : "Escolha a organização da agência primeiro"
              }
              searchPlaceholder="Buscar formulário"
              emptyLabel="Nenhum formulário nesta organização."
              disabled={!hasAgency}
              isLoading={isLoadingOptions}
            />
          </SettingsField>
        </SettingsGrid>
      </SettingsCard>
    </div>
  );
}
