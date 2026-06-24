"use client";

/**
 * DunningRulesTab — lista + editor de Réguas de Cobrança.
 *
 * UX: lista no topo (cards), editor expansível quando uma régua é selecionada.
 * Steps são ordenados por `daysOffset` ASC e desenhados como timeline visual.
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
  Mail,
  MessageSquare,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Star,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDunningRules,
  useCreateDunningRule,
  useUpdateDunningRule,
  useDeleteDunningRule,
  useCreateDunningStep,
  useUpdateDunningStep,
  useDeleteDunningStep,
} from "../../hooks/use-payment-dunning";

const CHANNEL_ICONS = {
  EMAIL:    Mail,
  WHATSAPP: MessageSquare,
  SMS:      Smartphone,
} as const;

const CHANNEL_LABELS = {
  EMAIL:    "Email",
  WHATSAPP: "WhatsApp",
  SMS:      "SMS (em breve)",
} as const;

export function DunningRulesTab() {
  const { data, isLoading } = useDunningRules();
  const createRule = useCreateDunningRule();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleCreate() {
    createRule.mutate(
      { name: "Nova régua", isDefault: false, steps: [] },
      {
        onSuccess: ({ rule }) => {
          setSelectedId(rule.id);
          toast.success("Régua criada — adicione steps");
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
            Steps disparam via Inngest event-driven (sem cron). Idempotente.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={createRule.isPending} size="sm">
          {createRule.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
          Nova régua
        </Button>
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
  steps: Array<{
    id: string;
    order: number;
    daysOffset: number;
    channel: "EMAIL" | "WHATSAPP" | "SMS";
    templateSubject: string | null;
    templateBody: string;
    enabled: boolean;
  }>;
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
    if (!confirm(`Excluir régua "${rule.name}"? Não desfaz envios já feitos.`)) return;
    deleteRule.mutate(
      { id: rule.id },
      { onSuccess: () => toast.success("Régua excluída") },
    );
  }
  function handleAddStep() {
    createStep.mutate(
      {
        ruleId:       rule.id,
        order:        rule.steps.length,
        daysOffset:   rule.steps.length === 0 ? -3 : 0,
        channel:      "WHATSAPP",
        templateBody: "Olá {{contato}}, lembrete que o boleto de {{valor}} vence em {{vencimento}}.",
        enabled:      true,
      },
      { onSuccess: () => toast.success("Step adicionado") },
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
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[10px]">
              <Star className="size-2.5 mr-0.5" />
              Padrão
            </Badge>
          )}
          {rule.isActive ? (
            <Badge variant="outline" className="border-green-500/40 text-green-600 text-[10px]">Ativa</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Desligada</Badge>
          )}
          <span className="text-[11px] text-muted-foreground ml-1">
            {rule.steps.length} step{rule.steps.length === 1 ? "" : "s"}
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
              {rule.isActive ? <ToggleRight className="size-4 text-green-600" /> : <ToggleLeft className="size-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleDefault} title={rule.isDefault ? "Remover padrão" : "Marcar como padrão"}>
              <Star className={`size-4 ${rule.isDefault ? "fill-amber-500 text-amber-500" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} title="Excluir régua">
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>

          {/* Timeline de steps */}
          <div className="space-y-2">
            {sortedSteps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sem steps. Adicione o primeiro pra começar.
              </p>
            ) : (
              sortedSteps.map((step) => <StepEditor key={step.id} step={step} />)
            )}
            <Button
              onClick={handleAddStep}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={createStep.isPending}
            >
              <Plus className="size-3.5 mr-1" />
              Adicionar step
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StepEditor({
  step,
}: {
  step: RuleData["steps"][number];
}) {
  const updateStep = useUpdateDunningStep();
  const deleteStep = useDeleteDunningStep();

  const [daysOffset, setDaysOffset] = useState(step.daysOffset);
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS">(step.channel);
  const [subject, setSubject] = useState(step.templateSubject ?? "");
  const [body, setBody] = useState(step.templateBody);
  const Icon = CHANNEL_ICONS[channel] ?? Mail;

  function persist(patch: Partial<{
    daysOffset: number;
    channel: "EMAIL" | "WHATSAPP" | "SMS";
    templateSubject: string | null;
    templateBody: string;
    enabled: boolean;
  }>) {
    updateStep.mutate({ id: step.id, ...patch });
  }

  function offsetLabel(d: number) {
    if (d === 0) return "no dia do vencimento";
    if (d < 0) return `${Math.abs(d)} dias antes do vencimento`;
    return `${d} dias após o vencimento`;
  }

  return (
    <Card className="p-3 bg-background">
      <div className="flex items-start gap-3">
        <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${
          channel === "EMAIL" ? "bg-blue-500/15 text-blue-600"
          : channel === "WHATSAPP" ? "bg-green-500/15 text-green-600"
          : "bg-muted text-muted-foreground"
        }`}>
          <Icon className="size-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Quando</Label>
              <Input
                type="number"
                value={daysOffset}
                onChange={(e) => setDaysOffset(parseInt(e.target.value || "0", 10))}
                onBlur={() => daysOffset !== step.daysOffset && persist({ daysOffset })}
                min={-30}
                max={60}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">{offsetLabel(daysOffset)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Canal</Label>
              <Select
                value={channel}
                onValueChange={(v) => {
                  setChannel(v as "EMAIL" | "WHATSAPP" | "SMS");
                  persist({ channel: v as "EMAIL" | "WHATSAPP" | "SMS" });
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["EMAIL", "WHATSAPP", "SMS"] as const).map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{CHANNEL_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {channel === "EMAIL" && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Assunto do email</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onBlur={() => subject !== (step.templateSubject ?? "") && persist({ templateSubject: subject || null })}
                placeholder="Cobrança — {{descricao}}"
                className="h-8 text-xs"
                maxLength={200}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Mensagem</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => body !== step.templateBody && persist({ templateBody: body })}
              rows={3}
              className="text-xs font-mono"
              maxLength={2000}
              placeholder="Use {{contato}} {{valor}} {{vencimento}} {{empresa}} {{descricao}}"
            />
            <p className="text-[10px] text-muted-foreground">
              Variáveis: <code>{`{{contato}}`}</code> <code>{`{{valor}}`}</code> <code>{`{{vencimento}}`}</code> <code>{`{{empresa}}`}</code> <code>{`{{descricao}}`}</code>
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Excluir esse step?")) deleteStep.mutate({ id: step.id });
          }}
        >
          <Trash2 className="size-3.5 text-red-500" />
        </Button>
      </div>
    </Card>
  );
}
