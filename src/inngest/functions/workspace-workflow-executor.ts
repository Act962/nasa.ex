import { NonRetriableError } from "inngest";
import { inngest } from "../client";
import prisma from "@/lib/prisma";
import { topologicalSort } from "../utils";
import { NodeType } from "@/generated/prisma/enums";
import { getWorkspaceExecutor } from "@/features/workspace-executions/lib/executor-registry";
import { loadActionContext } from "@/features/workspace-executions/lib/load-action-context";
import {
  wsAddParticipantChannel,
  wsAddTagChannel,
  wsArchiveActionChannel,
  wsCreateActionChannel,
  wsCreateSubActionChannel,
  wsFilterChannel,
  wsManualTriggerChannel,
  wsMoveActionChannel,
  wsSendEmailChannel,
  wsSendMessageChannel,
  wsSetResponsibleChannel,
  wsWaitChannel,
} from "../channels/workspace";

const triggerToNodeType: Record<string, NodeType> = {
  WS_MANUAL_TRIGGER: NodeType.WS_MANUAL_TRIGGER,
  WS_ACTION_CREATED: NodeType.WS_ACTION_CREATED,
  WS_ACTION_MOVED_COLUMN: NodeType.WS_ACTION_MOVED_COLUMN,
  WS_ACTION_TAGGED: NodeType.WS_ACTION_TAGGED,
  WS_ACTION_COMPLETED: NodeType.WS_ACTION_COMPLETED,
  WS_ACTION_PARTICIPANT_ADDED: NodeType.WS_ACTION_PARTICIPANT_ADDED,
};

export const executeWorkspaceWorkflow = inngest.createFunction(
  { id: "execute-workspace-workflow", retries: 0 },
  {
    event: "workspace-workflow/trigger",
    channels: [
      wsManualTriggerChannel(),
      wsCreateActionChannel(),
      wsMoveActionChannel(),
      wsAddTagChannel(),
      wsAddParticipantChannel(),
      wsSetResponsibleChannel(),
      wsCreateSubActionChannel(),
      wsSendMessageChannel(),
      wsSendEmailChannel(),
      wsArchiveActionChannel(),
      wsWaitChannel(),
      wsFilterChannel(),
    ],
  },
  async ({ event, step, publish }) => {
    const {
      trigger,
      workspaceId,
      actionId,
      workflowId,
      initialData,
      columnId,
      tagId,
    } = event.data as {
      trigger: keyof typeof triggerToNodeType;
      workspaceId: string;
      actionId?: string;
      workflowId?: string;
      initialData?: Record<string, any>;
      columnId?: string;
      tagId?: string;
    };

    const triggerNodeType = triggerToNodeType[trigger];
    if (!triggerNodeType) {
      throw new NonRetriableError(`Unknown workspace trigger: ${trigger}`);
    }

    const workflows = await step.run("find-ws-workflows", async () => {
      if (workflowId) {
        const wf = await prisma.workflow.findUnique({
          where: { id: workflowId },
          include: { nodes: true, connections: true },
        });
        return wf && wf.workspaceId ? [wf] : [];
      }
      const candidates = await prisma.workflow.findMany({
        where: {
          workspaceId,
          isActive: true,
          nodes: { some: { type: triggerNodeType } },
        },
        include: { nodes: true, connections: true },
      });

      // Para o gatilho de "ação movida", só mantém workflows cujo node
      // de gatilho esteja configurado para a coluna de destino real.
      if (trigger === "WS_ACTION_MOVED_COLUMN") {
        if (!columnId) return [];
        return candidates.filter((wf) =>
          wf.nodes.some((n) => {
            if (n.type !== triggerNodeType) return false;
            const cfg = (n.data as any)?.action as
              | { columnId?: string }
              | undefined;
            return cfg?.columnId === columnId;
          }),
        );
      }

      // Para "ação etiquetada", o node exige ao menos uma tag configurada;
      // só roda workflows cujo array tagIds inclua a tag recém aplicada.
      if (trigger === "WS_ACTION_TAGGED") {
        if (!tagId) return [];
        return candidates.filter((wf) =>
          wf.nodes.some((n) => {
            if (n.type !== triggerNodeType) return false;
            const cfg = (n.data as any)?.action as
              | { tagIds?: string[] }
              | undefined;
            if (!Array.isArray(cfg?.tagIds) || cfg.tagIds.length === 0) {
              return false;
            }
            return cfg.tagIds.includes(tagId);
          }),
        );
      }

      return candidates;
    });

    if (!workflows.length) return { ran: 0 };

    // Fan-out: quando múltiplos workflows batem no mesmo trigger sem um workflowId
    // fixado, cada um precisa rodar em seu próprio invocation para evitar colisão
    // de step IDs (Inngest memoiza por ID dentro do mesmo invocation).
    if (!workflowId && workflows.length > 1) {
      await step.run("fan-out-workflows", async () => {
        await inngest.send(
          workflows.map((wf) => ({
            name: "workspace-workflow/trigger" as const,
            data: {
              trigger,
              workspaceId,
              actionId,
              workflowId: wf.id,
              initialData,
              columnId,
              tagId,
            },
          })),
        );
      });
      return { fanOut: true, total: workflows.length };
    }

    // Carrega contexto da action dentro de um step para evitar re-execuções
    // desnecessárias do banco a cada replay do Inngest.
    const actionCtx = await step.run("load-action-context", async () => {
      return actionId ? loadActionContext(actionId) : null;
    });

    const wf = workflows[0];
    const sortedNodes = topologicalSort(wf.nodes as any, wf.connections as any);
    let context: Record<string, any> = {
      ...(initialData ?? {}),
      workspaceId: wf.workspaceId,
      action: actionCtx ?? (initialData as any)?.action,
      realTime: Boolean(workflowId),
      columnId,
    };

    try {
      for (const node of sortedNodes) {
        const executor = getWorkspaceExecutor(node.type as NodeType);
        context = await executor({
          data: node.data as Record<string, unknown>,
          nodeId: node.id,
          context,
          step,
          publish,
        });
      }
    } catch (err) {
      if (err instanceof NonRetriableError) {
        return { ran: 0, total: 1, skipped: err.message };
      }
      throw err;
    }

    return { ran: 1, total: 1 };
  },
);
