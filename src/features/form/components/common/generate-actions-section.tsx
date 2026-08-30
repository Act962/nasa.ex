"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormSettings } from "@/generated/prisma/client";
import { useBuilderStore } from "../../context/builder-form-provider";
import {
  useColumnsByWorkspace,
  useWorkspacesByTracking,
} from "@/features/workspace/hooks/use-workspace";
import { listFillableFields } from "@/features/form/lib/list-fillable-fields";
import {
  EMPTY_ACTION_TEMPLATE,
  resolveGenerateActionsConfig,
  type ActionTemplate,
  type DueDatePreset,
  type GenerateActionsConfig,
} from "@/features/form/lib/generate-actions-config";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionTitleComposer } from "./action-title-composer";

const AUTO = "__auto__";
const NONE = "__none__";
const MAX_ATTACHED_FORMS = 20;

function toggleAttachedForm(
  attachFormIds: string[],
  formId: string,
  shouldAttach: boolean,
): string[] {
  if (!shouldAttach) {
    return attachFormIds.filter((attached) => attached !== formId);
  }
  if (attachFormIds.includes(formId)) return attachFormIds;
  return [...attachFormIds, formId].slice(0, MAX_ATTACHED_FORMS);
}

function presetToKey(preset: DueDatePreset | null): string {
  if (!preset) return NONE;
  return preset.preset;
}

function keyToPreset(key: string, days: number): DueDatePreset | null {
  switch (key) {
    case "today":
      return { preset: "today" };
    case "tomorrow":
      return { preset: "tomorrow" };
    case "end_of_week":
      return { preset: "end_of_week" };
    case "in_days":
      return { preset: "in_days", days };
    default:
      return null;
  }
}

export function GenerateActionsSection() {
  const { formData, blockLayouts, updateSettings } = useBuilderStore();
  const settings = formData?.settings ?? null;

  const config = resolveGenerateActionsConfig(
    (settings as { generateActionsConfig?: unknown } | null)
      ?.generateActionsConfig,
  );
  const template = config.template ?? EMPTY_ACTION_TEMPLATE;
  const trackingId = settings?.trackingId ?? "";

  const { data: workspacesData } = useWorkspacesByTracking(trackingId);
  const workspaces = workspacesData?.workspaces ?? [];
  const { columns } = useColumnsByWorkspace(template.workspaceId ?? "");

  const imageFields = listFillableFields(blockLayouts).filter(
    (field) => field.blockType === "ImageUpload",
  );

  // O form gerador entra na pauta automaticamente (posição 0) — só os outros
  // publicados da org podem ser escolhidos aqui.
  const { forms: organizationForms } = useQueryListForms();
  const attachableForms = organizationForms.filter(
    (candidate) => candidate.published && candidate.id !== formData?.id,
  );

  if (!settings) return null;

  const patch = (next: GenerateActionsConfig) =>
    updateSettings({
      generateActionsConfig: next,
    } as unknown as Partial<FormSettings>);

  const patchTemplate = (updates: Partial<ActionTemplate>) =>
    patch({ enabled: config.enabled, template: { ...template, ...updates } });

  const dueDateDays =
    template.dueDate?.preset === "in_days" ? template.dueDate.days : 3;

  // O quadro/coluna salvos podem ter sumido (tracking trocado, item deletado).
  // Sem um item correspondente, o Select ficaria em branco e mascararia o alvo
  // inválido — renderizamos um item sintético "indisponível" pra sinalizar.
  const workspaceMissing =
    !!template.workspaceId &&
    workspaces.length > 0 &&
    !workspaces.some((workspace) => workspace.id === template.workspaceId);
  const columnMissing =
    !!template.columnId &&
    columns.length > 0 &&
    !columns.some((column) => column.id === template.columnId);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">Gerar tarefas (Actions)</h3>
          <p className="text-xs text-muted-foreground">
            Cria uma tarefa no quadro a partir de cada resposta enviada.
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) =>
            patch({
              enabled,
              template: config.template ?? EMPTY_ACTION_TEMPLATE,
            })
          }
        />
      </div>

      {config.enabled && (
        <div className="space-y-4 rounded-md border p-3">
          <Field>
            <FieldLabel>Título da tarefa</FieldLabel>
            <ActionTitleComposer
              blocks={blockLayouts}
              value={template.title}
              onChange={(title) => patchTemplate({ title })}
            />
          </Field>

          <Field>
            <FieldLabel>Workspace</FieldLabel>
            {!trackingId ? (
              <p className="text-[11px] text-amber-500">
                Selecione um tracking em “Direcionamento” para listar os
                workpaces conectados.
              </p>
            ) : (
              <Select
                value={template.workspaceId ?? AUTO}
                onValueChange={(value) =>
                  patchTemplate({
                    workspaceId: value === AUTO ? null : value,
                    columnId: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o quadro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>
                    Automático (primeiro quadro do tracking)
                  </SelectItem>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                  {workspaceMissing && (
                    <SelectItem value={template.workspaceId as string}>
                      Quadro indisponível — revise
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field>
            <FieldLabel>Coluna</FieldLabel>
            <Select
              value={template.columnId ?? AUTO}
              onValueChange={(value) =>
                patchTemplate({ columnId: value === AUTO ? null : value })
              }
              disabled={!template.workspaceId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    template.workspaceId
                      ? "Escolha a coluna"
                      : "Escolha um quadro primeiro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>
                  Automático (primeira coluna)
                </SelectItem>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.name}
                  </SelectItem>
                ))}
                {columnMissing && (
                  <SelectItem value={template.columnId as string}>
                    Coluna indisponível — revise
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Imagem de capa</FieldLabel>
            <Select
              value={template.coverImage?.blockId ?? NONE}
              onValueChange={(value) =>
                patchTemplate({
                  coverImage:
                    value === NONE ? null : { blockId: value, index: 0 },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {imageFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {imageFields.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Adicione um campo de upload de imagem para usar como capa.
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel>Prazo (vencimento)</FieldLabel>
            <Select
              value={presetToKey(template.dueDate)}
              onValueChange={(key) =>
                patchTemplate({ dueDate: keyToPreset(key, dueDateDays) })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem prazo</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="tomorrow">Amanhã</SelectItem>
                <SelectItem value="in_days">Em N dias</SelectItem>
                <SelectItem value="end_of_week">Fim da semana</SelectItem>
              </SelectContent>
            </Select>
            {template.dueDate?.preset === "in_days" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Dias:</span>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  className="h-8 w-24"
                  value={dueDateDays}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    const days =
                      Number.isFinite(parsed) && parsed >= 0
                        ? Math.min(Math.trunc(parsed), 365)
                        : 0;
                    patchTemplate({ dueDate: { preset: "in_days", days } });
                  }}
                />
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel>Formulários da tarefa</FieldLabel>
            <p className="text-xs text-muted-foreground">
              Toda tarefa gerada por este formulário já nasce com estes
              checklists na pauta — o técnico não precisa anexá-los um a um.
            </p>
            {attachableForms.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum outro formulário publicado nesta organização.
              </p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-2">
                {attachableForms.map((attachable) => (
                  <label
                    key={attachable.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={template.attachFormIds.includes(attachable.id)}
                      onCheckedChange={(checked) =>
                        patchTemplate({
                          attachFormIds: toggleAttachedForm(
                            template.attachFormIds,
                            attachable.id,
                            checked === true,
                          ),
                        })
                      }
                    />
                    <span className="truncate">{attachable.name}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        </div>
      )}
    </section>
  );
}
