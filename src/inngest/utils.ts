import { Connection, Node } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";
import toposort from "toposort";
import { inngest } from "./client";
import prisma from "@/lib/prisma";

export const topologicalSort = (
  nodes: Node[],
  connections: Connection[]
): Node[] => {
  if (connections.length === 0) {
    return nodes;
  }

  const edges: [string, string][] = connections.map((conn) => [
    conn.fromNodeId,
    conn.toNodeId,
  ]);

  const connectedNodeIds = new Set<string>();

  for (const conn of connections) {
    connectedNodeIds.add(conn.fromNodeId);
    connectedNodeIds.add(conn.toNodeId);
  }

  for (const node of nodes) {
    if (!connectedNodeIds.has(node.id)) {
      edges.push([node.id, node.id]);
    }
  }

  // Perform topological sort
  let sortedNodeIds: string[];

  try {
    sortedNodeIds = toposort(edges);
    // Remove dublicates (from self-edges)
    sortedNodeIds = [...new Set(sortedNodeIds)];
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cyclic")) {
      throw new Error("Workflow has a cycle");
    }
    throw error;
  }

  // Map sorted node IDS back to node objects
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return sortedNodeIds.map((id) => nodeMap.get(id)!).filter(Boolean);
};

/**
 * Tipos canônicos de trigger reconhecidos pela engine `runWorkflow`. Lista
 * espelha `isTriggerNode` em `src/features/workflows/lib/validate-node.ts`
 * e os trigger-nodes em `runWorkflow.ts:464-489`.
 *
 * O `WORKFLOW_EXECUTION` na engine encontra trigger node por `n.type === triggerType`,
 * então enviar o valor errado (ou omitir) faz o run abortar como FAILED com
 * mensagem "Nenhum trigger node do tipo X no workflow." — bug recorrente
 * que motivou a tipagem forte.
 */
export type WorkflowTriggerType =
  | "INITIAL"
  | "MANUAL_TRIGGER"
  | "NEW_LEAD"
  | "MOVE_LEAD_STATUS"
  | "LEAD_TAGGED"
  | "AI_FINISHED"
  | "FIRST_CHAT_INTERACTION"
  | "FIRST_INTERACTION_OF_DAY"
  | "LAST_INBOUND_TIMEOUT"
  | "PAYMENT_RECEIVED"
  | "MESSAGE_INCOMING"
  | "WEBHOOK_EXTERNAL";

/**
 * Shape mínimo do lead que a engine precisa pra popular `context.lead` e
 * resolver placeholders `{{lead.X}}` nos nodes. Call-sites podem passar
 * objeto mais rico — só id+trackingId é exigido.
 */
export type WorkflowDispatchLead = {
  id: string;
  trackingId: string;
  [key: string]: unknown;
};

/**
 * Dispatch tipado pra Inngest. `triggerType` agora é OBRIGATÓRIO — sem ele
 * a engine cai no default `MANUAL_TRIGGER` (em `inngest/functions.ts:69`) e
 * 99% das vezes não encontra o trigger node certo. Use os helpers
 * `dispatch*` abaixo em vez de chamar isso direto sempre que possível.
 */
export const sendWorkflowExecution = async (data: {
  workflowId: string;
  triggerType: WorkflowTriggerType;
  leadId?: string | null;
  initialData?: Record<string, unknown>;
  [key: string]: unknown;
}) => {
  return inngest.send({
    name: "workflow/execute.workflow",
    data,
  });
};

/** Trigger NEW_LEAD — disparado quando lead acaba de ser criado no tracking. */
export const dispatchNewLead = async (args: {
  workflowId: string;
  lead: WorkflowDispatchLead;
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "NEW_LEAD",
    leadId: args.lead.id,
    initialData: { lead: args.lead },
  });

/**
 * Trigger LEAD_TAGGED — uma chamada por workflow que casou com a(s) tag(s)
 * adicionada(s). `tagIds` no payload são as tags adicionadas naquele batch
 * (não necessariamente as do trigger; a engine só precisa do triggerType,
 * `tagIds` vai pra contexto/placeholders).
 */
export const dispatchLeadTagged = async (args: {
  workflowId: string;
  lead: WorkflowDispatchLead;
  tagIds: string[];
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "LEAD_TAGGED",
    leadId: args.lead.id,
    initialData: { lead: args.lead, tagIds: args.tagIds },
  });

/** Trigger MOVE_LEAD_STATUS — disparado quando lead muda de status no pipeline. */
export const dispatchMoveLeadStatus = async (args: {
  workflowId: string;
  lead: WorkflowDispatchLead;
  previousLead?: WorkflowDispatchLead;
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "MOVE_LEAD_STATUS",
    leadId: args.lead.id,
    initialData: {
      lead: args.lead,
      ...(args.previousLead ? { previousLead: args.previousLead } : {}),
    },
  });

/** Trigger FIRST_CHAT_INTERACTION — primeira mensagem do atendente humano. */
export const dispatchFirstChatInteraction = async (args: {
  workflowId: string;
  lead: WorkflowDispatchLead;
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "FIRST_CHAT_INTERACTION",
    leadId: args.lead.id,
    initialData: { lead: args.lead },
  });

/**
 * Trigger FIRST_INTERACTION_OF_DAY — lead já existente volta a mandar mensagem
 * pela primeira vez no "dia lógico" (corte configurável, fuso SP).
 */
export const dispatchFirstInteractionOfDay = async (args: {
  workflowId: string;
  lead: WorkflowDispatchLead;
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "FIRST_INTERACTION_OF_DAY",
    leadId: args.lead.id,
    initialData: { lead: args.lead },
  });

/** Trigger AI_FINISHED — IA do tracking encerrou atendimento (transfer/finish). */
export const dispatchAiFinished = async (args: {
  workflowId: string;
  lead: WorkflowDispatchLead;
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "AI_FINISHED",
    leadId: args.lead.id,
    initialData: { lead: args.lead },
  });

/**
 * Trigger MANUAL_TRIGGER — botão "executar" do painel ou Astro AI tool.
 * Sem lead específico (engine roda com contexto vazio + initialData).
 */
export const dispatchManualTrigger = async (args: {
  workflowId: string;
  lead?: WorkflowDispatchLead | Record<string, unknown>;
}) =>
  sendWorkflowExecution({
    workflowId: args.workflowId,
    triggerType: "MANUAL_TRIGGER",
    leadId: (args.lead as { id?: string } | undefined)?.id ?? null,
    initialData: { lead: args.lead ?? {} },
  });

/**
 * Broadcast pra acordar `WAIT_FOR_EVENT` em workflows agent-mode em
 * execução. Diferente dos `dispatch*` acima (que disparam UM workflow
 * específico via `triggerType`), isto é evento global com `leadId` —
 * a engine de WAIT_FOR_EVENT casa por `data.leadId` e qualquer workflow
 * suspenso pra esse lead acorda.
 *
 * Eventos suportados (precisam casar com os presets em
 * `agent-node-forms.tsx WAIT_FOR_EVENT`):
 *   - "lead-tagged"          ← chamado em add-tags / apply-tags-by-ai
 *   - "lead-status-changed"  ← chamado em update / update-many-status
 *   - "ai-finished"          ← chamado em chat/ia/deactive
 *
 * Best-effort: catch erros pra não derrubar o caller.
 */
/**
 * Eventos "soft" que workflows ESCUTAM via WAIT_FOR_EVENT (não disparam runs
 * novos — pra isso, usa `dispatchLeadTagged`, `dispatchMoveLeadStatus`, etc).
 *
 * Race-friendly: o engine de WAIT_FOR_EVENT aceita múltiplos `eventNames`
 * em paralelo (Promise.race no Inngest), então um workflow pode acordar
 * com QUALQUER um dos seguintes — o primeiro que chegar ganha:
 *
 *   - "message-incoming"     ← lead escreve no WhatsApp
 *   - "lead-tagged"          ← user OU IA aplica tag (add-tags / apply-tags-by-ai)
 *   - "lead-status-changed"  ← user OU automação move status (update / update-many)
 *   - "ai-finished"          ← user desliga IA do lead (chat/ia/deactive)
 *   - "proposal-opened"      ← lead abre o link público da proposta
 *   - "proposal-accepted"    ← lead clica "Aceitar" → cria contrato no Forge
 *   - "proposal-rejected"    ← lead clica "Recusar" / status muda
 *   - "contract-opened"      ← lead abre a página de assinatura
 *   - "contract-signed"      ← lead conclui a assinatura (allSigned)
 *
 * Best-effort: catch erros pra não derrubar o caller.
 */
export type AgentWorkflowSoftEvent =
  | "lead-tagged"
  | "lead-status-changed"
  | "ai-finished"
  | "message-incoming"
  | "proposal-opened"
  | "proposal-accepted"
  | "proposal-rejected"
  | "contract-opened"
  | "contract-signed";

export const broadcastAgentWorkflowEvent = async (args: {
  event: AgentWorkflowSoftEvent;
  leadId: string;
  trackingId: string;
  organizationId?: string;
  extra?: Record<string, unknown>;
}): Promise<void> => {
  try {
    await inngest.send({
      name: `agent-workflow/${args.event}`,
      data: {
        leadId: args.leadId,
        trackingId: args.trackingId,
        organizationId: args.organizationId,
        ...(args.extra ?? {}),
      },
    });
  } catch (err) {
    console.error(
      `[broadcastAgentWorkflowEvent:${args.event}] dispatch failed`,
      err,
    );
  }
};

export type WorkspaceWorkflowTrigger =
  | "WS_MANUAL_TRIGGER"
  | "WS_ACTION_CREATED"
  | "WS_ACTION_MOVED_COLUMN"
  | "WS_ACTION_TAGGED"
  | "WS_ACTION_COMPLETED"
  | "WS_ACTION_PARTICIPANT_ADDED";

/**
 * Verifica se há algum workflow ativo no workspace com um nó de gatilho
 * "ação movida" configurado para a coluna de destino. Usado para evitar
 * disparar eventos Inngest que rodariam um function call sem efeito.
 */
export const hasMovedColumnWorkflow = async (
  workspaceId: string,
  columnId: string,
) => {
  const node = await prisma.node.findFirst({
    where: {
      type: NodeType.WS_ACTION_MOVED_COLUMN,
      data: {
        path: ["action", "columnId"],
        equals: columnId,
      },
      workflow: {
        workspaceId,
        isActive: true,
      },
    },
    select: { id: true },
  });
  return !!node;
};

/**
 * Verifica se há algum workflow ativo no workspace com um nó de gatilho
 * "ação etiquetada" cujo array de tagIds inclua a tag aplicada. Usado para
 * evitar disparar eventos Inngest sem nenhuma automação ouvinte.
 */
export const hasTaggedWorkflow = async (
  workspaceId: string,
  tagId: string,
) => {
  const node = await prisma.node.findFirst({
    where: {
      type: NodeType.WS_ACTION_TAGGED,
      data: {
        path: ["action", "tagIds"],
        array_contains: tagId,
      },
      workflow: {
        workspaceId,
        isActive: true,
      },
    },
    select: { id: true },
  });
  return !!node;
};

/**
 * Verifica se há algum workflow ativo no workspace com um nó de gatilho
 * "ação criada". Usado para evitar disparar eventos Inngest sem ouvintes.
 */
export const hasActionCreatedWorkflow = async (workspaceId: string) => {
  const node = await prisma.node.findFirst({
    where: {
      type: NodeType.WS_ACTION_CREATED,
      workflow: {
        workspaceId,
        isActive: true,
      },
    },
    select: { id: true },
  });
  return !!node;
};

/**
 * Verifica se há algum workflow ativo no workspace com um nó de gatilho
 * "ação concluída". Usado para evitar disparar eventos Inngest sem ouvintes.
 */
export const hasActionCompletedWorkflow = async (workspaceId: string) => {
  const node = await prisma.node.findFirst({
    where: {
      type: NodeType.WS_ACTION_COMPLETED,
      workflow: {
        workspaceId,
        isActive: true,
      },
    },
    select: { id: true },
  });
  return !!node;
};

export const sendWorkspaceWorkflowEvent = async (data: {
  trigger: WorkspaceWorkflowTrigger;
  workspaceId: string;
  actionId?: string;
  workflowId?: string; // optional: force a specific workflow (manual trigger)
  initialData?: Record<string, any>;
  columnId?: string; // destination column for WS_ACTION_MOVED_COLUMN
  tagId?: string; // tag aplicada para WS_ACTION_TAGGED
  [key: string]: any;
}) => {
  return inngest.send({
    name: "workspace-workflow/trigger",
    data,
  });
};
