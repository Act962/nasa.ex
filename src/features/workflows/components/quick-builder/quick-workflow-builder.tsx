"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, GitBranchIcon, Loader2Icon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { useQuickCreateWorkflow, useQuickDraftWorkflow, useQuickDuplicates } from "@/features/workflows/hooks/use-quick-builder";
import type { QuickBlueprintEdge, QuickBlueprintNode, QuickStep } from "@/features/workflows/lib/quick-builder/steps";
import { QUICK_CATALOG, QUICK_CATEGORY_LABELS, findCatalogItem, type QuickCategory } from "./quick-catalog";
import { QuickStepFields } from "./quick-step-fields";

// Construtor rápido de Gatilhos Automáticos (spec 0039): frase ou selects,
// passos lineares "Quando → Então", alerta de duplicação e modo avançado.

interface SuggestedTag {
  slug: string;
  name: string;
  color?: string;
  reason?: string;
}

interface QuickWorkflowBuilderProps {
  trackingId: string;
  leadId?: string;
  leadName?: string;
  onCreated?: () => void;
}

const ACTION_CATEGORIES = Object.keys(QUICK_CATEGORY_LABELS) as Exclude<QuickCategory, "trigger">[];

function stepLabel(step: QuickStep): string {
  return findCatalogItem(step.type)?.label ?? step.name ?? step.type;
}

export function QuickWorkflowBuilder({ trackingId, leadId, leadName, onCreated }: QuickWorkflowBuilderProps) {
  const router = useRouter();
  const draftWorkflow = useQuickDraftWorkflow();
  const createWorkflow = useQuickCreateWorkflow();
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<QuickStep[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([]);
  const [branchedFlow, setBranchedFlow] = useState<{ nodes: QuickBlueprintNode[]; edges: QuickBlueprintEdge[] } | null>(null);
  const [shouldActivate, setShouldActivate] = useState(true);

  const debouncedSteps = useDebouncedValue(steps, 600);
  const duplicates = useQuickDuplicates({ trackingId, leadId, steps: debouncedSteps }).data?.duplicates ?? [];

  const trigger = steps[0];
  const actions = steps.slice(1);
  const hasReviewStep = steps.some((step) => step.data.needsReview === true);
  const canCreate = Boolean(trigger) && (branchedFlow !== null || actions.length > 0);
  const examples = [
    `Todo dia às 9h me lembra de retornar para ${leadName ?? "o lead"}`,
    leadName ? `Se ${leadName} mandar mensagem, me avisa` : "Quando o lead receber a tag Quente, envia uma mensagem de boas-vindas",
  ];

  const buildFromPrompt = (text: string) => {
    setPrompt(text);
    draftWorkflow.mutate(
      { trackingId, prompt: text, leadId },
      {
        onSuccess: (draft) => {
          setSteps(draft.steps);
          setName(draft.name);
          setSuggestedTags(draft.suggestedTags);
          setBranchedFlow(draft.branchedFlow);
          if (!draft.startsWithTrigger) toast.warning("Não identifiquei o gatilho (\"Quando\"). Escolha abaixo.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const setTrigger = (type: string) => {
    const item = findCatalogItem(type);
    if (!item) return;
    setBranchedFlow(null);
    setSteps((current) => [{ type, data: structuredClone(item.defaultData) }, ...current.slice(1)]);
  };

  const addAction = (type: string) => {
    const item = findCatalogItem(type);
    if (!item) return;
    setBranchedFlow(null);
    setSteps((current) => [...current, { type, data: structuredClone(item.defaultData) }]);
  };

  const updateStep = (index: number, data: Record<string, unknown>) =>
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? { ...step, data } : step)));

  const removeStep = (index: number) => {
    setBranchedFlow(null);
    setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index));
  };

  const create = (openAdvanced: boolean) => {
    const workflowName = name.trim() || `${stepLabel(trigger)} → ${actions.map(stepLabel).join(" → ")}`.slice(0, 120);
    createWorkflow.mutate(
      {
        trackingId,
        leadId,
        name: workflowName,
        steps,
        suggestedTags,
        activate: shouldActivate && !openAdvanced,
        branchedFlow: branchedFlow ?? undefined,
      },
      {
        onSuccess: (created) => {
          toast.success(
            created.isActive
              ? "Gatilho criado e ligado."
              : created.needsReview
                ? "Gatilho criado desligado: complete os passos marcados no modo avançado."
                : "Gatilho criado.",
          );
          onCreated?.();
          if (openAdvanced || created.needsReview || branchedFlow) router.push(created.editorUrl);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2 rounded-2xl bg-muted/40 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim().length >= 8) buildFromPrompt(prompt.trim());
        }}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 shrink-0 text-violet-500" />
          <Input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={`Descreva o gatilho. Ex.: ${examples[0]}`}
            className="h-9 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="sm" disabled={draftWorkflow.isPending || prompt.trim().length < 8}>
            {draftWorkflow.isPending ? <Loader2Icon className="size-4 animate-spin" /> : "Montar"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => buildFromPrompt(example)}
              className="rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/10"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      <ol className="relative flex flex-col gap-2 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
        <StepShell index={1} title="Quando">
          <Select value={trigger?.type} onValueChange={setTrigger}>
            <SelectTrigger size="sm" className="h-8 w-64 text-xs">
              <SelectValue placeholder="Escolha o gatilho" />
            </SelectTrigger>
            <SelectContent>
              {QUICK_CATALOG.filter((item) => item.category === "trigger").map((item) => (
                <SelectItem key={item.type} value={item.type}>
                  <item.icon className="size-3.5" />
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {trigger && <QuickStepFields step={trigger} trackingId={trackingId} onChange={(data) => updateStep(0, data)} />}
        </StepShell>

        {actions.map((step, actionIndex) => {
          const item = findCatalogItem(step.type);
          const Icon = item?.icon;
          return (
            <StepShell
              key={`${step.type}-${actionIndex}`}
              index={actionIndex + 2}
              title={actionIndex === 0 ? "Então" : "E depois"}
              onRemove={() => removeStep(actionIndex + 1)}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {Icon && <Icon className="size-4 text-muted-foreground" />}
                {stepLabel(step)}
                {step.data.needsReview === true && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">revisar no avançado</span>
                )}
              </div>
              <QuickStepFields step={step} trackingId={trackingId} onChange={(data) => updateStep(actionIndex + 1, data)} />
            </StepShell>
          );
        })}

        {trigger && (
          <li className="relative flex items-center gap-3 pl-0">
            <span className="z-10 flex size-8 items-center justify-center rounded-full border bg-background">
              <PlusIcon className="size-4 text-muted-foreground" />
            </span>
            <Select value="" onValueChange={addAction}>
              <SelectTrigger size="sm" className="h-8 w-64 text-xs">
                <SelectValue placeholder="Adicionar passo" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_CATEGORIES.map((category) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{QUICK_CATEGORY_LABELS[category]}</SelectLabel>
                    {QUICK_CATALOG.filter((item) => item.category === category).map((item) => (
                      <SelectItem key={item.type} value={item.type}>
                        <item.icon className="size-3.5" />
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </li>
        )}
      </ol>

      {branchedFlow && (
        <div className="flex items-start gap-2 rounded-xl bg-violet-500/10 p-3 text-xs text-violet-300">
          <GitBranchIcon className="mt-0.5 size-4 shrink-0" />
          Esse fluxo tem ramificações (Se/Senão, decisão da IA). Ele será criado inteiro e aberto no modo avançado.
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Já existe um gatilho ligado com essa mesma lógica{leadId ? " para este lead" : ""}:</p>
            <ul className="mt-1 list-disc pl-4">
              {duplicates.map((duplicate) => (
                <li key={duplicate.workflowId}>
                  <a href={`/tracking/${trackingId}/workflows/${duplicate.workflowId}`} className="underline" target="_blank" rel="noreferrer">
                    {duplicate.name}
                  </a>{" "}
                  ({duplicate.scope === "lead" ? "deste lead" : "do tracking todo"})
                </li>
              ))}
            </ul>
            <p className="mt-1">Criar outro fará o lead receber as ações duas vezes.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do gatilho (opcional)"
          className="h-8 min-w-48 flex-1 text-xs"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={shouldActivate && !hasReviewStep} disabled={hasReviewStep} onCheckedChange={setShouldActivate} />
          Ligar ao criar
        </label>
        <Button variant="outline" size="sm" disabled={!canCreate || createWorkflow.isPending} onClick={() => create(true)}>
          Modo avançado
        </Button>
        <Button size="sm" disabled={!canCreate || createWorkflow.isPending} onClick={() => create(false)}>
          {createWorkflow.isPending && <Loader2Icon className="size-4 animate-spin" />}
          Criar gatilho
        </Button>
      </div>
    </div>
  );
}

function StepShell({
  index,
  title,
  onRemove,
  children,
}: {
  index: number;
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-3">
      <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
        {index}
      </span>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border bg-muted/30 p-3")}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
          {onRemove && (
            <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground" aria-label="Remover passo">
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </li>
  );
}
