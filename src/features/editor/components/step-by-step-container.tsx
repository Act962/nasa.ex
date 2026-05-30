"use client";

/**
 * Container do modo Step-by-Step — único componente que o editor
 * renderiza. Cuida de:
 *   - Botão de toggle (entra/sai do modo)
 *   - Trigger picker (quando workflow tem múltiplos triggers)
 *   - Mock lead editor (basic — name/email/phone)
 *   - Popover por nodeType (escuta evento `step-by-step:open-popover`
 *     disparado pelo click no rocket)
 *   - Controles globais: Voltar / Resetar / Status atual
 *
 * Componentes auxiliares moram aqui mesmo pra reduzir surface.
 */
import { useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useAtomValue } from "jotai";
import {
  FlaskConicalIcon,
  PlayIcon,
  RotateCcwIcon,
  UndoIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useStepByStep } from "../hooks/use-step-by-step";
import {
  isStepByStepActiveAtom,
  stepByStepStateAtom,
} from "../store/step-by-step-atoms";

/** Triggers reconhecidos como entry points (workflow.lib/validate-node). */
const TRIGGER_TYPES = new Set([
  "INITIAL",
  "MANUAL_TRIGGER",
  "NEW_LEAD",
  "MOVE_LEAD_STATUS",
  "LEAD_TAGGED",
  "AI_FINISHED",
  "FIRST_CHAT_INTERACTION",
  "LAST_INBOUND_TIMEOUT",
  "PAYMENT_RECEIVED",
  "MESSAGE_INCOMING",
  "WEBHOOK_EXTERNAL",
]);

export function StepByStepContainer({ workflowId }: { workflowId: string }) {
  const isActive = useAtomValue(isStepByStepActiveAtom);
  const state = useAtomValue(stepByStepStateAtom);
  const { start, stepNode, rollback, reset, setMockLead, isLoading } =
    useStepByStep(workflowId);
  const { getNodes } = useReactFlow();

  const [setupOpen, setSetupOpen] = useState(false);
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [branchChoice, setBranchChoice] = useState<string>("");

  // Triggers existentes no workflow (lidos do React Flow store)
  const triggers = useMemo(
    () => getNodes().filter((n) => n.type && TRIGGER_TYPES.has(n.type)),
    [getNodes, setupOpen],
  );

  // Escuta click no rocket de qualquer node → abre popover
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { nodeId: string };
      if (detail?.nodeId) {
        setPopoverNodeId(detail.nodeId);
        setBranchChoice("");
      }
    };
    window.addEventListener("step-by-step:open-popover", handler);
    return () => window.removeEventListener("step-by-step:open-popover", handler);
  }, []);

  const currentNodeData = useMemo(
    () =>
      popoverNodeId ? getNodes().find((n) => n.id === popoverNodeId) : null,
    [popoverNodeId, getNodes],
  );

  // Pra resolver branches dinâmicas (AI_DECISION com branches custom),
  // lê do node.data ou retorna outputs default por tipo
  const branchesFor = (nodeType?: string, nodeData?: Record<string, unknown>) => {
    if (!nodeType) return [];
    if (nodeType === "AI_DECISION") {
      const raw = (nodeData?.branches as Array<{ id: string; label?: string }>) ?? [];
      return raw.map((b) => ({ id: b.id, label: b.label ?? b.id }));
    }
    if (nodeType === "IF_CONDITION") {
      return [
        { id: "true", label: "Verdadeiro" },
        { id: "false", label: "Falso" },
      ];
    }
    if (nodeType === "CHECK_PAYMENT") {
      return [
        { id: "paid", label: "Pago" },
        { id: "pending", label: "Pendente" },
        { id: "failed", label: "Falhou" },
      ];
    }
    if (nodeType === "LOOP_OVER") {
      return [
        { id: "loop", label: "Próxima iteração" },
        { id: "done", label: "Concluído" },
      ];
    }
    if (nodeType === "SWITCH_CASE") {
      const cases = (nodeData?.cases ?? nodeData?.branches) as
        | Array<{ id?: string; value?: string; label?: string }>
        | undefined;
      return (cases ?? []).map((c) => ({
        id: c.id ?? c.value ?? "case",
        label: c.label ?? c.value ?? "case",
      }));
    }
    return [];
  };

  const needsBranchChoice =
    currentNodeData?.type &&
    ["AI_DECISION", "IF_CONDITION", "CHECK_PAYMENT", "SWITCH_CASE", "LOOP_OVER"].includes(
      currentNodeData.type,
    );
  const branches = branchesFor(
    currentNodeData?.type,
    currentNodeData?.data as Record<string, unknown>,
  );

  const handleStartClick = () => {
    if (triggers.length === 1) {
      setSelectedTrigger(triggers[0].id);
      setSetupOpen(true);
    } else if (triggers.length > 1) {
      setSelectedTrigger("");
      setSetupOpen(true);
    } else {
      // sem trigger — não pode iniciar
      return;
    }
  };

  const handleStartConfirm = () => {
    if (!selectedTrigger) return;
    start(selectedTrigger);
    setSetupOpen(false);
  };

  const handleAdvance = async () => {
    await stepNode(needsBranchChoice ? branchChoice : undefined);
    setPopoverNodeId(null);
    setBranchChoice("");
  };

  const handleExit = () => {
    reset();
    setPopoverNodeId(null);
    setBranchChoice("");
  };

  const stats = useMemo(() => {
    const passed = Object.values(state.nodeStatuses).filter(
      (s) => s === "passed",
    ).length;
    const failed = Object.values(state.nodeStatuses).filter(
      (s) => s === "failed",
    ).length;
    const warning = Object.values(state.nodeStatuses).filter(
      (s) => s === "warning",
    ).length;
    return { passed, failed, warning };
  }, [state.nodeStatuses]);

  return (
    <>
      {/* Botão principal */}
      {!isActive ? (
        <Button
          variant="outline"
          size="sm"
          className="bg-background gap-1.5"
          onClick={handleStartClick}
          disabled={triggers.length === 0}
          title={triggers.length === 0 ? "Workflow sem trigger" : "Testar passo-a-passo"}
        >
          <FlaskConicalIcon className="size-3.5" />
          Testar passo-a-passo
        </Button>
      ) : (
        // Controles ativos
        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg px-2 py-1">
          <Badge variant="default" className="bg-blue-500 text-[10px]">
            STEP MODE
          </Badge>
          <span className="text-[11px] text-blue-700 dark:text-blue-300 tabular-nums">
            ✓{stats.passed} ⚠{stats.warning} ✗{stats.failed}
          </span>
          <div className="w-px h-4 bg-blue-300 mx-1" />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={rollback}
            disabled={state.visitOrder.length <= 1}
            title="Voltar 1 passo"
          >
            <UndoIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              if (state.startTriggerNodeId) {
                start(state.startTriggerNodeId);
                setPopoverNodeId(null);
              }
            }}
            title="Reiniciar do trigger"
          >
            <RotateCcwIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleExit}
            title="Sair do modo"
            className="text-destructive hover:text-destructive"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Setup dialog (trigger + mock lead) */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar teste passo-a-passo</DialogTitle>
            <DialogDescription>
              Escolha qual trigger simular e ajuste os mocks do lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Trigger picker */}
            <div className="space-y-1.5">
              <Label className="text-xs">Trigger inicial</Label>
              <Select value={selectedTrigger} onValueChange={setSelectedTrigger}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um trigger" />
                </SelectTrigger>
                <SelectContent>
                  {triggers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.type}
                      {(t.data as { name?: string })?.name
                        ? ` — ${(t.data as { name?: string }).name}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mock lead */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Mock do lead
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Nome"
                  value={state.mockLead.name ?? ""}
                  onChange={(e) => setMockLead({ name: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={state.mockLead.email ?? ""}
                  onChange={(e) => setMockLead({ email: e.target.value })}
                />
                <Input
                  placeholder="Phone"
                  value={state.mockLead.phone ?? ""}
                  onChange={(e) => setMockLead({ phone: e.target.value })}
                />
                <div className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={state.mockLead.isActive ?? true}
                    onCheckedChange={(v) => setMockLead({ isActive: v })}
                  />
                  <span>isActive</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStartConfirm} disabled={!selectedTrigger}>
              <PlayIcon className="size-3.5" />
              Iniciar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog do nó atual — abre via click no rocket. Usamos Dialog em
          vez de Popover porque o rocket é renderizado dentro do node
          (BaseExecutionNode) e o container vive no Panel; sem anchor
          comum, Popover não posiciona. Dialog centralizado funciona. */}
      {popoverNodeId && currentNodeData && (
        <Dialog
          open={!!popoverNodeId}
          onOpenChange={(o) => !o && setPopoverNodeId(null)}
        >
          <DialogContent className="sm:max-w-md p-0">
            <NodePopoverBody
              nodeType={currentNodeData.type ?? ""}
              nodeData={currentNodeData.data as Record<string, unknown>}
              errors={state.nodeErrors[popoverNodeId] ?? []}
              warnings={state.nodeWarnings[popoverNodeId] ?? []}
              branches={branches}
              needsBranchChoice={!!needsBranchChoice}
              branchChoice={branchChoice}
              onBranchChange={setBranchChoice}
              onAdvance={handleAdvance}
              onClose={() => setPopoverNodeId(null)}
              isLoading={isLoading}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// NodePopoverBody — conteúdo do popover (separado pra clareza)
// ─────────────────────────────────────────────────────────────────
function NodePopoverBody({
  nodeType,
  nodeData,
  errors,
  warnings,
  branches,
  needsBranchChoice,
  branchChoice,
  onBranchChange,
  onAdvance,
  onClose,
  isLoading,
}: {
  nodeType: string;
  nodeData: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  branches: Array<{ id: string; label: string }>;
  needsBranchChoice: boolean;
  branchChoice: string;
  onBranchChange: (v: string) => void;
  onAdvance: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  // Preview do conteúdo principal por nodeType
  const preview = useMemo(() => {
    const action = (nodeData?.action ?? {}) as Record<string, unknown>;
    const payload = (action?.payload ?? {}) as Record<string, unknown>;
    if (nodeType === "SEND_MESSAGE") {
      const t = String(payload.type ?? "TEXT");
      const text = String(
        payload.message ?? payload.text ?? payload.bodyText ?? "(sem texto)",
      );
      return { label: `Mensagem (${t})`, value: text };
    }
    if (nodeType === "TAG") {
      const tagsIds = (action.tagsIds ?? action.tagIds) as string[] | undefined;
      return {
        label: `${String(action.type ?? "ADD")} tag(s)`,
        value: tagsIds?.join(", ") ?? "(nenhuma)",
      };
    }
    if (nodeType === "WAIT") {
      const days = action.days as number | undefined;
      const minutes = action.minutes as number | undefined;
      return {
        label: "Aguardar",
        value:
          days != null
            ? `${days} dia(s)`
            : minutes != null
              ? `${minutes} minuto(s)`
              : "(sem tempo)",
      };
    }
    if (nodeType === "WAIT_FOR_EVENT") {
      return {
        label: "Aguardar evento",
        value: `${String(nodeData.eventName ?? "?")} (timeout ${String(nodeData.timeoutMinutes ?? "?")}min)`,
      };
    }
    if (nodeType === "AI_DECISION") {
      return {
        label: "Decisão IA",
        value: String(nodeData.prompt ?? "(sem prompt)"),
      };
    }
    if (nodeType === "MOVE_LEAD") {
      return {
        label: "Mover lead",
        value: `status: ${String(action.statusId ?? "?")}`,
      };
    }
    return { label: nodeType, value: JSON.stringify(nodeData).slice(0, 200) };
  }, [nodeType, nodeData]);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {nodeType}
          </p>
          <p className="text-sm font-semibold">{preview.label}</p>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <XIcon className="size-3.5" />
        </Button>
      </div>

      {/* Preview do conteúdo */}
      <div className="rounded-md border bg-muted/40 p-2 text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
        {preview.value}
      </div>

      {/* Erros */}
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-destructive">
            Erros bloqueantes
          </p>
          <ul className="text-[11px] space-y-0.5 list-disc list-inside text-destructive">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-400">
            Avisos
          </p>
          <ul className="text-[11px] space-y-0.5 list-disc list-inside text-amber-700 dark:text-amber-400">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Branch picker */}
      {needsBranchChoice && branches.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Escolha o caminho</Label>
          <Select value={branchChoice} onValueChange={onBranchChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Sem chamar LLM — você simula a decisão manualmente.
          </p>
        </div>
      )}

      {/* Botão avançar */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
        <Button
          size="sm"
          onClick={onAdvance}
          disabled={
            isLoading || (needsBranchChoice && !branchChoice)
          }
          className={cn(
            errors.length > 0 && "bg-amber-500 hover:bg-amber-600",
          )}
        >
          <PlayIcon className="size-3.5" />
          {errors.length > 0 ? "Avançar mesmo assim" : "Avançar"}
        </Button>
      </div>
    </div>
  );
}
