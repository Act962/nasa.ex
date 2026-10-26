"use client";

/**
 * DunningRulesTab — lista + editor de Réguas de Cobrança.
 *
 * UX: lista no topo (cards), editor expansível quando uma régua é selecionada.
 * Avisos ordenados por `daysOffset` ASC; o card de cada um mora em `dunning-step-editor.tsx`.
 *
 * Comportamento defensivo:
 *   - Régua nasce com `isActive=false` (criação backend) — user revisa antes
 *     de ligar e disparar eventos pros entries existentes (fora do escopo MVP).
 *   - Apenas o Master pode marcar `isDefault=true` (validação server-side).
 *
 * Não dispara recálculo de eventos Inngest pra entries existentes quando
 * a régua é editada. Cobertura: novos entries pegam a nova versão.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ShieldCheck,
  Star,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { MessagingSenderSelect } from "./messaging-sender-select";
import { ConfirmDeleteDialog } from "../shared/confirm-delete-dialog";
import { DunningStepEditor, type DunningStepData } from "./dunning-step-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useDunningRules,
  useCreateDunningRule,
  useUpdateDunningRule,
  useDeleteDunningRule,
  useCreateDunningStep,
} from "../../hooks/use-payment-dunning";
import {
  DEFAULT_RULE_STEPS,
  MAX_DAYS_AFTER,
  MAX_RULE_STEPS,
  TIMING_PRESETS,
  defaultTemplateFor,
  describeRuleLimitProblem,
} from "../../lib/dunning-presets";

function buildDefaultStep(daysOffset: number, order: number) {
  const template = defaultTemplateFor(daysOffset);
  return {
    order,
    daysOffset,
    channel: "WHATSAPP" as const,
    templateSubject: template.subject,
    templateBody: template.body,
    enabled: true,
  };
}

/** Próximo prazo que a régua aceita (sem repetir e respeitando os limites); null se não houver. */
function nextFreeOffset(usedOffsets: number[]): number | null {
  const fitsRule = (offset: number) =>
    !usedOffsets.includes(offset) && describeRuleLimitProblem([...usedOffsets, offset]) === null;
  const preset = TIMING_PRESETS.find(fitsRule);
  if (preset !== undefined) return preset;
  for (let offset = Math.max(0, ...usedOffsets) + 1; offset <= MAX_DAYS_AFTER; offset++) {
    if (fitsRule(offset)) return offset;
  }
  return null;
}

export function DunningRulesTab() {
  const { data, isLoading } = useDunningRules();
  const createRule = useCreateDunningRule();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleCreate() {
    createRule.mutate(
      {
        name: "Nova régua",
        isDefault: false,
        steps: DEFAULT_RULE_STEPS.map((step, index) => buildDefaultStep(step.daysOffset, index)),
      },
      {
        onSuccess: ({ rule }) => {
          setSelectedId(rule.id);
          toast.success("Régua criada com 3 avisos prontos — revise e ligue quando quiser");
        },
        onError: (err) => toast.error(err.message ?? "Erro"),
      },
    );
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando réguas…</div>;
  }

  const rules = data?.rules ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Réguas de cobrança</h2>
          <p className="text-xs text-muted-foreground">
            Cada régua é um roteiro de avisos ao cliente, contado a partir do vencimento.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={createRule.isPending} size="sm">
          {createRule.isPending ? <OrbitaSpinner className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
          Nova régua
        </Button>
      </div>

      <MessagingSenderSelect />

      <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <div className="space-y-1 text-xs">
          <p className="font-medium">Cobrança ética, aplicada automaticamente</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>Avisos só saem entre 8h e 20h (horário de Brasília).</li>
            <li>No máximo um aviso por dia para o mesmo cliente, mesmo com várias cobranças.</li>
            <li>Pagou ou cancelou, os avisos param na hora.</li>
            <li>Os modelos têm tom respeitoso; termos que soam como ameaça geram alerta (CDC, art. 42).</li>
          </ul>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma régua criada ainda. Crie uma pra automatizar lembretes de
            cobrança via Email / WhatsApp.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleAccordion
              key={rule.id}
              rule={rule}
              isOpen={selectedId === rule.id}
              onToggle={() => setSelectedId(selectedId === rule.id ? null : rule.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RuleData {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  steps: Array<DunningStepData & { order: number }>;
}

function RuleAccordion({
  rule,
  isOpen,
  onToggle,
}: {
  rule: RuleData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const updateRule = useUpdateDunningRule();
  const deleteRule = useDeleteDunningRule();
  const createStep = useCreateDunningStep();

  const [name, setName] = useState(rule.name);
  const [savingName, setSavingName] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  function handleToggleActive() {
    updateRule.mutate(
      { id: rule.id, isActive: !rule.isActive },
      { onSuccess: () => toast.success(rule.isActive ? "Régua desativada" : "Régua ativada") },
    );
  }
  function handleToggleDefault() {
    updateRule.mutate(
      { id: rule.id, isDefault: !rule.isDefault },
      { onSuccess: () => toast.success(rule.isDefault ? "Não é mais padrão" : "Marcada como padrão") },
    );
  }
  function handleSaveName() {
    if (name === rule.name) return;
    setSavingName(true);
    updateRule.mutate(
      { id: rule.id, name },
      {
        onSettled: () => setSavingName(false),
        onSuccess: () => toast.success("Nome atualizado"),
      },
    );
  }
  function handleDelete() {
    deleteRule.mutate(
      { id: rule.id },
      {
        onSuccess: () => {
          setIsConfirmingDelete(false);
          toast.success("Régua excluída");
        },
        onError: (err) => toast.error(err.message ?? "Erro ao excluir régua"),
      },
    );
  }
  function handleAddStep() {
    const daysOffset = nextFreeOffset(rule.steps.map((step) => step.daysOffset));
    if (daysOffset === null) return toast.error("Não há prazo livre que respeite os limites da régua.");
    createStep.mutate(
      { ruleId: rule.id, ...buildDefaultStep(daysOffset, rule.steps.length) },
      {
        onSuccess: () => toast.success("Aviso adicionado"),
        onError: (error) => toast.error(error.message ?? "Não foi possível adicionar o aviso"),
      },
    );
  }

  const sortedSteps = [...rule.steps].sort((a, b) => a.daysOffset - b.daysOffset);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/30 text-left"
      >
        <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-sm">{rule.name}</span>
          {rule.isDefault && (
            <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
              <Star className="size-2.5 mr-0.5" />
              Padrão
            </Badge>
          )}
          {rule.isActive ? (
            <Badge variant="outline" className="border-success/40 text-success text-[10px]">Ativa</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Desligada</Badge>
          )}
          <span className="text-[11px] text-muted-foreground ml-1">
            {rule.steps.length} aviso{rule.steps.length === 1 ? "" : "s"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t bg-muted/10">
          {/* Header row: nome + toggles + delete */}
          <div className="pt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              placeholder="Nome da régua"
              className="text-sm"
              disabled={savingName}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
              title={rule.isActive ? "Desligar régua" : "Ligar régua"}
            >
              {rule.isActive ? <ToggleRight className="size-4 text-success" /> : <ToggleLeft className="size-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleDefault} title={rule.isDefault ? "Remover padrão" : "Marcar como padrão"}>
              <Star className={`size-4 ${rule.isDefault ? "fill-warning text-warning" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(true)} title="Excluir régua">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>

          {/* Timeline de steps */}
          <div className="space-y-2">
            {sortedSteps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sem avisos. Adicione o primeiro para começar.
              </p>
            ) : (
              sortedSteps.map((step) => (
                <DunningStepEditor
                  key={step.id}
                  step={step}
                  hasSameDayStep={sortedSteps.some(
                    (other) => other.id !== step.id && other.enabled && other.daysOffset === step.daysOffset,
                  )}
                  otherOffsets={sortedSteps.filter((other) => other.id !== step.id).map((other) => other.daysOffset)}
                />
              ))
            )}
            <Button
              onClick={handleAddStep}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={createStep.isPending || rule.steps.length >= MAX_RULE_STEPS}
              title={rule.steps.length >= MAX_RULE_STEPS ? `Limite de ${MAX_RULE_STEPS} avisos por régua` : undefined}
            >
              <Plus className="size-3.5 mr-1" />
              {rule.steps.length >= MAX_RULE_STEPS ? `Limite de ${MAX_RULE_STEPS} avisos` : "Adicionar aviso"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        isOpen={isConfirmingDelete}
        title="Excluir régua"
        description={`Excluir a régua "${rule.name}"? Os avisos já enviados não são desfeitos.`}
        isPending={deleteRule.isPending}
        onConfirm={handleDelete}
        onClose={() => setIsConfirmingDelete(false)}
      />
    </Card>
  );
}
