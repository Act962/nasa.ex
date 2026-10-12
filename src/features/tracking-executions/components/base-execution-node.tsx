"use client";
import { RichNodePreview } from "@/features/editor/components/rich/rich-node-preview";
import { IconNodeCaption, IconNodeGlyph, hasIconCaption, hasIconGlyph } from "@/features/editor/components/rich/icon-node-hint";
import { FlowNoticeBadge } from "@/features/editor/components/rich/flow-notice-badge";
import { AnimatedOutline, type OutlineTone } from "@/features/editor/components/rich/animated-outline";
import { hasRichPreview } from "@/features/editor/components/rich/rich-node-types";
import { connectionHoverAtom, editorReadOnlyAtom, editorViewModeAtom } from "@/features/editor/store/atoms";
import { useIsNodeBlockedByFlowProblem, useNodeFlowDiagnostics } from "@/features/editor/hooks/use-flow-diagnostics";

import {
  ConnectionState,
  type NodeProps,
  Position,
  useConnection,
  useReactFlow,
  useUpdateNodeInternals,
  useStore,
} from "@xyflow/react";
import { PlusIcon, type LucideIcon } from "lucide-react";
import { createId } from "@paralleldrive/cuid2";
import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { WorkflowNode } from "@/components/workflow-node";
import { BaseNode, BaseNodeContent } from "@/components/react-flow/base-node";
import { validateNode } from "@/features/workflows/lib/validate-node";
import { useNodeIssues } from "@/features/workflows/components/workflow-issues-context";
import { useAtomValue } from "jotai";
import { stepByStepStateAtom } from "@/features/editor/store/step-by-step-atoms";
import { StepRocketOverlay } from "@/features/editor/components/step-rocket-overlay";
import Image from "next/image";
import { BaseHandle } from "@/components/react-flow/base-handle";
import {
  type NodeStatus,
  NodeStatusIndicator,
} from "@/components/react-flow/node-status-indicator";
import { NodeSelector } from "@/components/node-selector";
import { nextSide, readNodeSides, toPosition } from "@/features/editor/lib/node-sides";
import { formatWaitLabel } from "@/features/editor/lib/wait-label";
import { cn } from "@/lib/utils";
import { NO_CLICK_OUTPUT, buttonReplyOutputs } from "@/features/workflows/lib/button-reply-flow";
import { conversationStepOutputs } from "@/features/workflows/lib/conversation-steps";
import { menuOptionAnswersByRow, menuOptionOutputs } from "@/features/workflows/lib/menu-option-outputs";
import { useAiButtonPresets } from "@/features/tracking-settings/hooks/use-ai-button-presets";
import { ButtonHandle } from "@/components/react-flow/button-handle";
import { AddNextNodeButton } from "@/features/editor/components/add-next-node-button";

interface BaseExecutionNodeProps extends NodeProps {
  icon: LucideIcon | string;
  name: string;
  description?: string;
  children?: ReactNode;
  status?: NodeStatus;
  onSettings?: () => void;
  onDoubleClick?: () => void;
}

const selector = (connection: ConnectionState) => {
  return connection.inProgress;
};

export const BaseExecutionNode = memo(
  ({
    id,
    icon: Icon,
    name,
    description,
    children,
    status = "initial",
    onSettings,
    onDoubleClick,
    ...rest
  }: BaseExecutionNodeProps) => {
    const { setNodes, setEdges } = useReactFlow();
    // Validação automática — type + data vêm via NodeProps spread.
    const nodeType = (rest as any).type as string | undefined;
    const nodeData = (rest as any).data as Record<string, unknown> | undefined;
    const validation = useMemo(
      () => (nodeType ? validateNode(nodeType, nodeData) : undefined),
      [nodeType, nodeData],
    );
    // Issues estruturais (ORPHAN, TAG arquivada, UNREACHABLE, etc) vêm do
    // contexto preenchido pelo `useWorkflowValidation` no editor. Se algum
    // tem severity error, força borda vermelha mesmo que validateNode passe.
    const graphIssues = useNodeIssues(id);
    const hasGraphError = graphIssues.some((i) => i.severity === "error");
    // Erros previstos sobre o desenho da tela (regras do canal). O erro vem antes do aviso.
    const flowDiagnostics = useNodeFlowDiagnostics(id);
    const flowNotice =
      flowDiagnostics.find((diagnostic) => diagnostic.severity === "error") ?? flowDiagnostics[0];
    const hasFlowError = flowNotice?.severity === "error";
    // Visão "Visual": card do lead nos gatilhos e celular nas mensagens. Na visão de ícones nada muda.
    const viewMode = useAtomValue(editorViewModeAtom);
    const isRichView = viewMode === "rich";
    const isReadOnly = useAtomValue(editorReadOnlyAtom);
    // Saídas nomeadas: uma por botão (spec 0090, seção F) ou as do passo de conversa (spec 0099).
    const replyOutputs = useMemo(() => buttonReplyOutputs(nodeData) ?? conversationStepOutputs(nodeData), [nodeData]);
    // Menu salvo: uma saída por opção, além da saída de sempre (spec 0098).
    const { trackingId } = useParams<{ trackingId: string }>();
    const { presets: savedMenus } = useAiButtonPresets(trackingId ?? "");
    const optionOutputs = useMemo(() => (nodeType === "SEND_MESSAGE" ? menuOptionOutputs(nodeData, savedMenus) : null), [nodeType, nodeData, savedMenus]);
    const optionAnswers = useMemo(() => (nodeType === "SEND_MESSAGE" ? (menuOptionAnswersByRow(nodeData, savedMenus) ?? undefined) : undefined), [nodeType, nodeData, savedMenus]);
    const optionOutputsSignature = optionAnswers?.map((optionAnswer) => optionAnswer?.id ?? "").join("|") ?? "";
    // O contorno tracejado faz o papel da borda nas duas visões; do andamento só fica o que está acontecendo agora.
    const runStatus = status === "loading" || status === "success" ? status : "initial";
    const connectionHover = useAtomValue(connectionHoverAtom);
    const waitLabel = nodeType === "WAIT" ? formatWaitLabel(nodeData) : null;
    const showsRichPreview = isRichView && hasRichPreview(nodeType);
    const isBlockedByFlowProblem = useIsNodeBlockedByFlowProblem(id);
    const { inputSide, outputSide } = readNodeSides(nodeData);
    const updateNodeInternals = useUpdateNodeInternals();
    // As saídas por opção chegam depois dos menus carregarem: o React Flow precisa medir de novo.
    useEffect(() => {
      updateNodeInternals(id);
    }, [optionOutputsSignature, isRichView, id, updateNodeInternals]);
    const changeSide = (end: "inputSide" | "outputSide") => {
      const sides = readNodeSides(nodeData);
      const changedSide = end === "inputSide" ? nextSide(sides.inputSide, sides.outputSide) : nextSide(sides.outputSide, sides.inputSide);
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ui: { ...sides, [end]: changedSide } } } : node,
        ),
      );
    };
    // O React Flow só recalcula onde a ligação encosta quando avisado de que a alça mudou de lugar.
    useEffect(() => {
      updateNodeInternals(id);
    }, [id, inputSide, outputSide, updateNodeInternals]);
    const outlineTone: OutlineTone = flowNotice || isBlockedByFlowProblem ? "problem" : "ok";
    const [openSelector, setOpenSelector] = useState(false);
    const connectionInProgress = useConnection(selector);
    const isConnected = useStore((state) =>
      state.edges.some(
        (edge) => edge.source === id && edge.sourceHandle === "source-1",
      ),
    );

    const shouldShowButton = !connectionInProgress && !isConnected && !isReadOnly;

    const handleDelete = () => {
      setNodes((currentNodes) => {
        const updateNodes = currentNodes.filter((node) => node.id !== id);
        return updateNodes;
      });

      setEdges((currentEdges) => {
        const updateEdges = currentEdges.filter(
          (edge) => edge.source !== id && edge.target !== id,
        );
        return updateEdges;
      });
    };

    // Duplica este nó com offset (mesmo type + data clonada). Não copia
    // conexões — o operador precisa religar manualmente, evita criar
    // arestas duplicadas acidentalmente.
    const handleDuplicate = () => {
      setNodes((currentNodes) => {
        const original = currentNodes.find((n) => n.id === id);
        if (!original) return currentNodes;
        const clone = {
          ...original,
          id: createId(),
          position: {
            x: original.position.x + 40,
            y: original.position.y + 40,
          },
          // React Flow gera selected=true se herdar — força false pra não
          // confundir UI.
          selected: false,
          data: JSON.parse(JSON.stringify(original.data ?? {})),
        };
        return [...currentNodes, clone];
      });
    };

    // Abre o NodeSelector já com sourceId apontando pra este nó — ao
    // selecionar um novo type, NodeSelector cria o nó e a conexão
    // sourceId→novo automaticamente.
    const handleAddNext = () => setOpenSelector(true);

    // Validação falhou (não-skip) sobrescreve o status visual pra "error".
    // Operador vê borda vermelha pulsante e sabe que o nó vai derrubar o
    // workflow se ativar. Status de execução real (success/loading) só
    // aparece quando a validação passa. Graph issues (ORPHAN, ARCHIVED_TAG,
    // etc) também forçam erro mesmo se o nó isolado passa.
    //
    // `needsReview: true` no node.data sinaliza que IA generativa criou
    // o nó mas precisa de input humano (ex: "qual produto?", "qual user
    // responsável?"). Também força borda vermelha — user vê visual igual
    // ao de erro de validação, com tooltip explicando o que falta.
    const nodeInvalid = !!(validation && !validation.valid && !validation.skip);
    const needsReview = !!(nodeData?.needsReview === true);
    const effectiveStatus: typeof status =
      nodeInvalid || hasGraphError || hasFlowError || needsReview ? "error" : status;

    // ── Step-by-Step overlay (foguete pulsando ou check/erro) ───
    const stepState = useAtomValue(stepByStepStateAtom);
    const stepNodeStatus = stepState.active
      ? (stepState.nodeStatuses[id] ?? "idle")
      : "idle";
    // Click no rocket dispara abertura do popover via custom event —
    // o popover global escuta e abre pra esse nó.
    const handleRocketClick = () => {
      window.dispatchEvent(
        new CustomEvent("step-by-step:open-popover", { detail: { nodeId: id } }),
      );
    };

    return (
      <WorkflowNode
        name={name}
        description={description}
        showToolbar={!isReadOnly}
        onDelete={handleDelete}
        onSettings={isReadOnly ? undefined : onSettings}
        notice={isRichView ? undefined : flowNotice}
        onDuplicate={handleDuplicate}
        caption={!isRichView && nodeType && hasIconCaption(nodeType) ? <IconNodeCaption nodeType={nodeType} data={nodeData} /> : undefined}
        onCycleInputSide={() => changeSide("inputSide")}
        onCycleOutputSide={() => changeSide("outputSide")}
        onAddNext={handleAddNext}
      >
        <StepRocketOverlay status={stepNodeStatus} onClick={handleRocketClick} />
        <NodeStatusIndicator status={runStatus} variant="border">
          <BaseNode
            onDoubleClick={isReadOnly ? undefined : onDoubleClick}
            // Na visão "Visual" o contorno tracejado faz o papel da borda: a do quadro some para não brigarem.
            className="rounded-2xl border-transparent outline-none hover:bg-card hover:ring-0 focus:ring-0"
            status={status}
            // Na visão "Visual" o alerta do canto já explica o problema: o balão escuro ficaria repetido.
            validation={isRichView ? undefined : validation}
            graphErrorMessages={isRichView ? [] : [
              ...graphIssues
                .filter((i) => i.severity === "error")
                .map((i) => i.message),
              ...flowDiagnostics
                .filter((diagnostic) => diagnostic.severity === "error")
                .map((diagnostic) => diagnostic.message),
              // needsReview vira mensagem extra no tooltip da borda
              // vermelha — explica pro user o que IA generativa marcou
              // como pendente. Aparece junto com graph errors.
              ...(needsReview
                ? [
                    `🤖 IA marcou pra revisão: ${
                      (nodeData as { reviewReason?: string })?.reviewReason ??
                      "configurar campos faltantes"
                    }`,
                  ]
                : []),
            ]}
          >
            <BaseNodeContent
              className={cn(
                showsRichPreview ? "relative p-1" : "relative",
                waitLabel && "items-center gap-0.5",
              )}
            >
              <AnimatedOutline tone={outlineTone} radius={showsRichPreview ? 16 : 20} />
              {connectionHover?.nodeId === id && connectionHover.isAllowed && (
                <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-info/15">
                  <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-info text-white shadow-[0_0_10px_var(--info)]">
                    <PlusIcon className="size-4" strokeWidth={3} />
                  </span>
                </span>
              )}
              {isRichView && flowNotice && <FlowNoticeBadge notice={flowNotice} onFix={isReadOnly ? undefined : onSettings} />}
              {showsRichPreview && nodeType ? (
                <RichNodePreview nodeType={nodeType} data={nodeData} name={name} description={description} icon={Icon} isUndelivered={hasFlowError} optionOutputs={optionAnswers} />
              ) : !isRichView && nodeType && hasIconGlyph(nodeType) ? (
                <IconNodeGlyph nodeType={nodeType} data={nodeData} />
              ) : typeof Icon === "string" ? (
                <Image src={Icon} alt={name} width={16} height={16} />
              ) : (
                <Icon className="size-4 text-muted-foreground" />
              )}
              {waitLabel && <span className="whitespace-nowrap text-[9px] font-semibold leading-none text-muted-foreground">{waitLabel}</span>}
              {children}
              <BaseHandle
                id="target-1"
                type="target"
                position={toPosition(inputSide)}
              />
              {replyOutputs ? (
                // Menu que espera o clique: uma saída por botão, mais "Sem clique" (spec 0090, seção F).
                replyOutputs.map((replyOutput, outputIndex) => {
                  const offsetPercent = ((outputIndex + 1) / (replyOutputs.length + 1)) * 100;
                  const isSideways = outputSide === "left" || outputSide === "right";
                  return (
                    <BaseHandle
                      key={replyOutput.id}
                      id={replyOutput.id}
                      type="source"
                      position={toPosition(outputSide)}
                      style={isSideways ? { top: `${offsetPercent}%` } : { left: `${offsetPercent}%` }}
                    >
                      <span
                        className={cn(
                          "pointer-events-none absolute whitespace-nowrap rounded-full border bg-background px-1.5 py-0.5 text-[9px] font-medium leading-none",
                          outputSide === "right" && "left-3 top-1/2 -translate-y-1/2",
                          outputSide === "left" && "right-3 top-1/2 -translate-y-1/2",
                          outputSide === "bottom" && "left-1/2 top-3 -translate-x-1/2",
                          outputSide === "top" && "bottom-3 left-1/2 -translate-x-1/2",
                          replyOutput.id === NO_CLICK_OUTPUT && "text-muted-foreground",
                        )}
                      >
                        {replyOutput.label}
                      </span>
                    </BaseHandle>
                  );
                })
              ) : (
                <>
                {/* Na visão de ícones não há a lista de opções: as saídas ficam empilhadas na lateral. */}
                {!showsRichPreview &&
                  optionOutputs?.map((optionOutput, outputIndex) => (
                    <BaseHandle
                      key={optionOutput.id}
                      id={optionOutput.id}
                      type="source"
                      position={Position.Right}
                      title={`Quando o cliente toca em "${optionOutput.label}"`}
                      className="!border-info !bg-background"
                      style={{ top: `${((outputIndex + 1) / (optionOutputs.length + 1)) * 100}%` }}
                    />
                  ))}
                <NodeSelector
                  open={openSelector}
                  onOpenChange={setOpenSelector}
                  sourceId={id}
                >
                  <ButtonHandle
                    id="source-1"
                    type="source"
                    position={toPosition(outputSide)}
                    showButton={shouldShowButton}
                  >
                    <AddNextNodeButton />
                  </ButtonHandle>
                </NodeSelector>
                </>
              )}
            </BaseNodeContent>
          </BaseNode>
        </NodeStatusIndicator>
      </WorkflowNode>
    );
  },
);

BaseExecutionNode.displayName = "BaseExecutionNode";
