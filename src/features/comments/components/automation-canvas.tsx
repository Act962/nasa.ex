"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { MessageCircle, Send, Sparkles, Zap } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { BaseNode } from "@/components/react-flow/base-node";
import { cn } from "@/lib/utils";

/**
 * Canvas do editor. No PR 1 ele é **derivado**: os nós nascem dos dados da
 * automação, a posição é calculada e nada aqui persiste layout (spec 0024 D-9).
 *
 * Clicar num nó não edita no canvas — abre o Sheet de configuração na seção
 * correspondente. A Fase 2 liga o handle `+` e o node selector sem trocar
 * componente.
 */

/** Seção do Sheet que cada nó abre ao ser clicado. */
export type EditorSection = "trigger" | "match" | "response";

type CanvasNodeData = {
  title: string;
  subtitle: string;
  lines: string[];
  icon: "trigger" | "dm" | "reply" | "ai";
  hasError: boolean;
  errorMessage?: string;
  section: EditorSection;
};

const ICONS = {
  trigger: Zap,
  dm: Send,
  reply: MessageCircle,
  ai: Sparkles,
} as const;

function CommentsCanvasNode({ data }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const Icon = ICONS[nodeData.icon];

  return (
    <BaseNode
      className="w-[300px] cursor-pointer rounded-xl transition-shadow hover:shadow-lg"
      validation={{
        valid: !nodeData.hasError,
        errors: nodeData.errorMessage ? [nodeData.errorMessage] : [],
        skip: !nodeData.hasError,
      }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 p-1.5">
            <Icon className="size-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {nodeData.subtitle}
            </p>
            <p className="truncate text-sm font-medium">{nodeData.title}</p>
          </div>
        </div>

        {nodeData.lines.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            {nodeData.lines.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className={cn(
                  "truncate text-xs",
                  index === 0 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </BaseNode>
  );
}

const nodeTypes = { commentsNode: CommentsCanvasNode };

export type CanvasModel = {
  trigger: CanvasNodeData;
  steps: CanvasNodeData[];
};

export function AutomationCanvas({
  model,
  onNodeSelect,
  refitSignal,
}: {
  model: CanvasModel;
  onNodeSelect: (section: EditorSection) => void;
  /** Muda quando o painel abre/fecha — reenquadra o fluxo na nova largura. */
  refitSignal?: number;
}) {
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (refitSignal === undefined) return;
    // Espera a transição de largura terminar, senão reenquadra na medida velha.
    const timer = setTimeout(() => {
      instanceRef.current?.fitView({ padding: 0.25, duration: 250 });
    }, 320);
    return () => clearTimeout(timer);
  }, [refitSignal]);

  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node[] = [
      {
        id: "trigger",
        type: "commentsNode",
        position: { x: 0, y: 0 },
        data: model.trigger as unknown as Record<string, unknown>,
        draggable: false,
      },
    ];
    const builtEdges: Edge[] = [];

    model.steps.forEach((step, index) => {
      const id = `step-${index}`;
      builtNodes.push({
        id,
        type: "commentsNode",
        position: { x: 440, y: index * 190 },
        data: step as unknown as Record<string, unknown>,
        draggable: false,
      });
      builtEdges.push({
        id: `trigger-${id}`,
        source: "trigger",
        target: id,
        animated: true,
      });
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [model]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.3}
      nodesConnectable={false}
      nodesDraggable={false}
      proOptions={{ hideAttribution: true }}
      onInit={(instance) => {
        instanceRef.current = instance;
      }}
      onNodeClick={(_event, node) => {
        const data = node.data as unknown as CanvasNodeData;
        onNodeSelect(data.section);
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} />
      <MiniMap position="bottom-right" className="bg-background!" pannable />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}

export function buildCanvasModel(input: {
  eventType: "COMMENT_CREATED" | "DIRECT_MESSAGE_RECEIVED";
  targetScope: "ALL_CONTENT" | "SPECIFIC_CONTENT" | "NEXT_CONTENT";
  targetCount: number;
  includeTerms: string[];
  excludeTerms: string[];
  anyText: boolean;
  dmText: string;
  dmSource: "STATIC" | "AI";
  buttonCount: number;
  publicReplies: string[];
}): CanvasModel {
  const triggerLines: string[] = [];

  if (input.eventType === "COMMENT_CREATED") {
    triggerLines.push(
      input.targetScope === "ALL_CONTENT"
        ? "Em todas as publicações"
        : `${input.targetCount} publicação(ões) selecionada(s)`,
    );
  } else {
    triggerLines.push("Mensagem no direct");
  }

  triggerLines.push(
    input.anyText || input.includeTerms.length === 0
      ? "Qualquer texto"
      : `Contém: ${input.includeTerms.slice(0, 3).join(", ")}`,
  );
  if (input.excludeTerms.length > 0) {
    triggerLines.push(`Não contém: ${input.excludeTerms.slice(0, 3).join(", ")}`);
  }

  // Erro é POR NÓ: só fica vermelho o nó que tem o problema. Pintar tudo de
  // vermelho numa automação recém-criada não informa nada.
  const triggerMissingTargets =
    input.eventType === "COMMENT_CREATED" &&
    input.targetScope === "SPECIFIC_CONTENT" &&
    input.targetCount === 0;

  const steps: CanvasNodeData[] = [];
  const hasDmText = Boolean(input.dmText.trim());

  steps.push({
    icon: input.dmSource === "AI" ? "ai" : "dm",
    subtitle: "Instagram",
    title: input.dmSource === "AI" ? "Resposta por IA" : "Enviar mensagem",
    lines: [
      hasDmText
        ? input.dmText.trim()
        : input.dmSource === "AI"
          ? "Sem instruções para a IA"
          : "Sem texto definido",
      input.buttonCount > 0 ? `${input.buttonCount} botão(ões)` : "",
    ].filter(Boolean),
    hasError: !hasDmText,
    errorMessage: !hasDmText
      ? input.dmSource === "AI"
        ? "Escreva as instruções da IA."
        : "Escreva a mensagem do direct."
      : undefined,
    section: "response",
  });

  const replies = input.publicReplies.filter((reply) => reply.trim());
  if (replies.length > 0) {
    steps.push({
      icon: "reply",
      subtitle: "Instagram",
      title: "Responder no comentário",
      lines: [
        replies[0],
        replies.length > 1 ? `+${replies.length - 1} variação(ões)` : "",
      ].filter(Boolean),
      hasError: false,
      section: "response",
    });
  }

  return {
    trigger: {
      icon: "trigger",
      subtitle: "Quando...",
      title:
        input.eventType === "COMMENT_CREATED"
          ? "Alguém comenta"
          : "Alguém manda direct",
      lines: triggerLines,
      hasError: triggerMissingTargets,
      errorMessage: triggerMissingTargets
        ? "Escolha ao menos uma publicação."
        : undefined,
      section: "trigger",
    },
    steps,
  };
}
