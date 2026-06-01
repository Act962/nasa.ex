"use client";

/**
 * Componente visual genérico pros 14 NodeTypes do Modo Agente IA.
 *
 * Cada um (IF_CONDITION, AI_DECISION, SEND_VOICE, etc.) seria idealmente
 * um componente dedicado com Dialog/form específico — Fase 4/5 vai
 * detalhar. Fase 3 entrega MVP funcional:
 *
 *  - Ícone + label vindo de `agentModeNodes` em node-options.ts
 *  - Click abre `AgentNodeConfigDialog` com editor JSON cru (Textarea +
 *    parser tolerante). Power-users editam direto; UI específica vem depois.
 *  - Validação delegada pra `validateNode()` (já estendido com 14 cases).
 *  - Status indicator (initial / running / success / failed) via base.
 */
import { memo, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { type Node, type NodeProps, Position, useReactFlow } from "@xyflow/react";
import { BaseHandle } from "@/components/react-flow/base-handle";
import { BaseExecutionNode } from "./base-execution-node";
import { agentModeNodes, getNodeOutputs, triggerNodes } from "../lib/node-options";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AgentNodeForm } from "./agent-node-forms";

type AgentNodeData = Record<string, unknown>;
type AgentNodeType = Node<AgentNodeData>;

export function AgentNodeConfigDialog({
  open,
  onOpenChange,
  nodeType,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nodeType: string;
  initialData: AgentNodeData;
  onSave: (data: AgentNodeData) => void;
}) {
  const meta =
    agentModeNodes.find((n) => n.type === nodeType) ??
    triggerNodes.find((n) => n.type === nodeType);
  const [draft, setDraft] = useState<AgentNodeData>(() => initialData ?? {});

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
    toast.success("Configuração salva");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta?.label ?? nodeType}</DialogTitle>
          <DialogDescription>{meta?.description}</DialogDescription>
        </DialogHeader>

        <AgentNodeForm nodeType={nodeType} data={draft} onChange={setDraft} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const AgentNode = memo((props: NodeProps<AgentNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  // Triggers do Modo Agente IA (PAYMENT_RECEIVED, MESSAGE_INCOMING,
  // WEBHOOK_EXTERNAL) vivem em `triggerNodes` com agentModeOnly=true —
  // procurar nos dois arrays cobre todos os 17 NodeTypes mapeados em
  // node-components.ts pro AgentNode.
  const meta = useMemo(
    () =>
      agentModeNodes.find((n) => n.type === props.type) ??
      triggerNodes.find((n) => n.type === props.type),
    [props.type],
  );

  // Fallback defensivo (não deve acontecer com os 17 NodeTypes mapeados —
  // se aparecer, alguém adicionou um NodeType novo em node-components.ts
  // sem registrar em node-options).
  if (!meta) {
    console.warn("[AgentNode] NodeType sem metadata:", props.type);
    return (
      <BaseExecutionNode
        {...props}
        icon={HelpCircle}
        name={String(props.type)}
        description={`Nó "${props.type}" sem metadados — registrar em node-options.ts`}
        onSettings={() => setDialogOpen(true)}
        onDoubleClick={() => setDialogOpen(true)}
      />
    );
  }

  const handleSave = (data: AgentNodeData) => {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === props.id ? { ...n, data } : n)),
    );
    // toast já é disparado dentro do dialog
  };

  // Saídas semânticas (true/false, loop/done, branches da AI_DECISION, etc).
  // Renderiza handles extras à direita do nó, posicionados verticalmente.
  // O handle "main"/"source-1" do BaseExecutionNode continua existindo
  // pro caso de saída padrão.
  const outputs = useMemo(
    () => getNodeOutputs(String(props.type), (props.data as AgentNodeData) ?? {}),
    [props.type, props.data],
  );
  const hasMultipleOutputs = outputs.length > 1 || (outputs.length === 1 && outputs[0] !== "main");

  return (
    <>
      <BaseExecutionNode
        {...props}
        icon={meta.icon as never}
        name={meta.label}
        description={meta.description}
        onSettings={() => setDialogOpen(true)}
        onDoubleClick={() => setDialogOpen(true)}
      />
      {/* Handles nomeados extras — só renderiza se nó tem branches.
          Posicionamento vertical à direita; cada handle expõe sua label
          via tooltip nativo (title) pra discoverability sem markup pesado. */}
      {hasMultipleOutputs &&
        outputs.map((out, idx) => (
          <BaseHandle
            key={out}
            id={out}
            type="source"
            position={Position.Right}
            title={out}
            style={{
              top: `${20 + ((idx + 1) * 100) / (outputs.length + 1)}%`,
              transform: "translateY(-50%)",
            }}
            className="!bg-emerald-500 !border-emerald-300"
          />
        ))}
      <AgentNodeConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nodeType={String(props.type)}
        initialData={(props.data as AgentNodeData) ?? {}}
        onSave={handleSave}
      />
    </>
  );
});

AgentNode.displayName = "AgentNode";
