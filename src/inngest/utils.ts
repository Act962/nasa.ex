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

export const sendWorkflowExecution = async (data: {
  workflowId: string;
  [key: string]: any;
}) => {
  return inngest.send({
    name: "workflow/execute.workflow",
    data,
  });
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
