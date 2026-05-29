"use client";

import { NodeType } from "@/generated/prisma/enums";
import { createId } from "@paralleldrive/cuid2";
import { useNodes, useReactFlow } from "@xyflow/react";

import { SparklesIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  agentModeNodes,
  executionNodes,
  NodeTypeOption,
  triggerNodes,
} from "@/features/executions/lib/node-options";
import { useUpdateWorkflowAgentMode } from "@/features/workflows/hooks/use-workflows";
import { useWorkflowAgentMode } from "@/features/workflows/lib/agent-mode-context";

/**
 * Card quadrado de node — ícone centralizado + label embaixo + tooltip com
 * descrição on hover. Substitui o layout de lista horizontal (linha por node)
 * que poluía visualmente. Grid 3 colunas mantém a Sheet enxuta.
 */
function NodeCard({
  node,
  onClick,
}: {
  node: NodeTypeOption;
  onClick: () => void;
}) {
  const Icon = node.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="group flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border bg-background p-2 transition-all hover:border-primary hover:bg-accent/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {typeof Icon === "string" ? (
            <img
              src={Icon}
              alt={node.label}
              className="size-6 object-contain rounded-sm"
            />
          ) : (
            <Icon className="size-6 text-foreground group-hover:text-primary transition-colors" />
          )}
          <span className="text-[11px] font-medium leading-tight text-center line-clamp-2">
            {node.label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <p className="text-xs">{node.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface NodeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId?: string;
  children?: React.ReactNode;
  /** ID do workflow atual — necessário pra toggle "Modo Agente IA". */
  workflowId?: string;
  /** Workflow está em Modo Agente IA? Libera multi-trigger + nodes novos. */
  agentMode?: boolean;
}

export function NodeSelector({
  open,
  onOpenChange,
  sourceId,
  children,
  workflowId: workflowIdProp,
  agentMode: agentModeProp,
}: NodeSelectorProps) {
  // Lê do contexto se não vier por prop (caso comum: AddNodeButton +
  // BaseExecutionNode + BaseTriggerNode + InitialNode envolvidos no
  // WorkflowAgentModeProvider do editor).
  const ctx = useWorkflowAgentMode();
  const workflowId = workflowIdProp ?? ctx?.workflowId;
  const agentMode = agentModeProp ?? ctx?.agentMode ?? false;

  const { setNodes, getNodes, setEdges, screenToFlowPosition } = useReactFlow();
  // useNodes é REATIVO — re-renderiza quando nodes mudam (add/remove).
  // Necessário pra esconder a seção "Gatilhos" assim que o user adicionar
  // um gatilho, e voltar a mostrar quando ele apagar.
  const reactiveNodes = useNodes();
  const hasTriggerInWorkflow = reactiveNodes.some((node) =>
    triggerNodes.some((tn) => tn.type === node.type),
  );

  // Em Modo Agente IA, multi-trigger é permitido — sempre mostra seção
  // de gatilhos pra adicionar mais de um.
  const showTriggerSection = agentMode || !hasTriggerInWorkflow;

  // Filtra triggers pra esconder os que são exclusivos do Modo Agente IA
  // quando workflow está em modo clássico.
  const visibleTriggers = triggerNodes.filter(
    (t) => !t.agentModeOnly || agentMode,
  );

  // Toggle do Modo Agente IA (só renderiza se workflowId presente)
  const updateAgentMode = useUpdateWorkflowAgentMode(workflowId ?? "");

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      if (selection.category === "trigger" && !agentMode) {
        // Modo clássico: apenas 1 trigger permitido
        const nodes = getNodes();
        const hasTrigger = nodes.some((node) =>
          triggerNodes.some((tn) => tn.type === node.type),
        );

        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return;
        }
      }

      const newNodeId = createId();

      setNodes((nodes) => {
        const hasInitialTrigger = nodes.some(
          (node) => node.type === NodeType.INITIAL,
        );

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const flowPostion = screenToFlowPosition({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
        });

        const newNode = {
          id: newNodeId,
          data: {},
          position: flowPostion,
          type: selection.type,
        };

        if (hasInitialTrigger) {
          return [newNode];
        }

        return [...nodes, newNode];
      });

      if (sourceId) {
        setEdges((edges) => {
          return [
            ...edges,
            {
              id: createId(),
              source: sourceId,
              target: newNodeId,
              sourceHandle: "source-1",
              targetHandle: "target-1",
            },
          ];
        });
      }

      onOpenChange(false);
    },
    // `agentMode` é capturado no closure — sem ele nas deps, o callback
    // fica preso no valor inicial (false) mesmo depois do user ligar o
    // toggle. Idem `sourceId` e `setEdges`.
    [
      setNodes,
      getNodes,
      setEdges,
      onOpenChange,
      screenToFlowPosition,
      sourceId,
      agentMode,
    ],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Automações</SheetTitle>
          <SheetDescription>
            Selecione o tipo de automação que deseja adicionar ao fluxo.
          </SheetDescription>
        </SheetHeader>

        {/* ── Toggle "Modo Agente IA" — acima de Gatilhos ──
            Desbloqueia multi-gatilhos, multi-ações, condicionais, loops,
            decisão por IA, voz, mídia, sub-workflows. */}
        {workflowId && (
          <div className="mx-4 mt-2 mb-3 rounded-lg border bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/40 dark:to-cyan-950/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <SparklesIcon className="size-4 text-emerald-600" />
                  <span className="font-semibold text-sm">Modo Agente IA</span>
                  {agentMode && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 text-[10px] uppercase tracking-wide">
                      Ativo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Desbloqueia multi-gatilhos, condicionais, loops, nós de IA
                  (voz, imagem, PDF) e sub-workflows.
                </p>
              </div>
              <Switch
                checked={agentMode}
                disabled={updateAgentMode.isPending}
                onCheckedChange={(v) =>
                  updateAgentMode.mutate({ workflowId, agentMode: v })
                }
              />
            </div>
          </div>
        )}

        <TooltipProvider delayDuration={300}>
          <Accordion
            type="multiple"
            defaultValue={
              agentMode
                ? ["trigger", "execution", "agent-logic", "agent-ai", "agent-apps"]
                : ["trigger", "execution"]
            }
            className="w-full"
          >
            {/* Seção Gatilhos: em modo clássico some quando já existe um;
                em Modo Agente IA fica sempre visível (multi-trigger permitido). */}
            {showTriggerSection && (
              <AccordionItem value="trigger">
                <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                  Gatilhos
                  {agentMode && (
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                      Multi
                    </Badge>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                    {visibleTriggers.map((nodeType) => (
                      <NodeCard
                        key={nodeType.type}
                        node={nodeType}
                        onClick={() => handleNodeSelect(nodeType)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="execution">
              <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                Ações
              </AccordionTrigger>
              <AccordionContent>
                {/* Ações core sem sub-grupo */}
                <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                  {executionNodes
                    .filter((n) => !n.group)
                    .map((nodeType) => (
                      <NodeCard
                        key={nodeType.type}
                        node={nodeType}
                        onClick={() => handleNodeSelect(nodeType)}
                      />
                    ))}
                </div>

                {/* Sub-grupo "Adicionar Lead no App" — Form, Agenda, Forge,
                    Linnker, N-Box, NASA Route. */}
                {executionNodes.some((n) => n.group === "send-to-app") && (
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue="send-to-app"
                    className="border-t mt-2"
                  >
                    <AccordionItem value="send-to-app">
                      <AccordionTrigger className="px-4 pt-3 pb-3 text-xs uppercase tracking-wide text-muted-foreground hover:no-underline">
                        Apps
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                          {executionNodes
                            .filter((n) => n.group === "send-to-app")
                            .map((nodeType) => (
                              <NodeCard
                                key={nodeType.type}
                                node={nodeType}
                                onClick={() => handleNodeSelect(nodeType)}
                              />
                            ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* ── Categorias do Modo Agente IA — só aparecem quando ativo ── */}
            {agentMode && (
              <>
                <AccordionItem value="agent-logic">
                  <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                    Lógica
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                      Agente IA
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                      {agentModeNodes
                        .filter((n) => n.group === "logic")
                        .map((nodeType) => (
                          <NodeCard
                            key={nodeType.type}
                            node={nodeType}
                            onClick={() => handleNodeSelect(nodeType)}
                          />
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="agent-ai">
                  <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                    IA
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                      Agente IA
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                      {agentModeNodes
                        .filter((n) => n.group === "ai")
                        .map((nodeType) => (
                          <NodeCard
                            key={nodeType.type}
                            node={nodeType}
                            onClick={() => handleNodeSelect(nodeType)}
                          />
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="agent-apps">
                  <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                    Apps NASA & Comunicação
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                      Agente IA
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                      {agentModeNodes
                        .filter((n) => n.group === "nasa-apps")
                        .map((nodeType) => (
                          <NodeCard
                            key={nodeType.type}
                            node={nodeType}
                            onClick={() => handleNodeSelect(nodeType)}
                          />
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="agent-data">
                  <AccordionTrigger className="px-4 pt-5 hover:no-underline">
                    Dados & Sub-Workflows
                    <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                      Agente IA
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                      {agentModeNodes
                        .filter((n) => n.group === "data")
                        .map((nodeType) => (
                          <NodeCard
                            key={nodeType.type}
                            node={nodeType}
                            onClick={() => handleNodeSelect(nodeType)}
                          />
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </>
            )}
          </Accordion>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
