import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import prisma from "@/lib/prisma";
import { topologicalSort } from "./utils";
import { NodeType } from "@/generated/prisma/enums";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { httpRequestChannel } from "./channels/http-request";
import { manualTriggerChannel } from "./channels/manual-trigger";
import { moveLeadChannel } from "./channels/move-lead";
import { sendMessageChannel } from "./channels/send-message";
import { sendAppActionChannel } from "./channels/send-app-action";
import { waitChannel } from "./channels/wait";
import { tagChannel } from "./channels/tag";
import { responsibleChannel } from "./channels/responsible";
import { temperatureChannel } from "./channels/temperature";
import { winLossChannel } from "./channels/win-loss";
import { filterLeadChannel } from "./channels/filter-lead";

export const executeWorkflow = inngest.createFunction(
  { id: "execute-workflow", retries: 0 },
  {
    event: "workflow/execute.workflow",
    channels: [
      httpRequestChannel(),
      manualTriggerChannel(),
      moveLeadChannel(),
      sendMessageChannel(),
      sendAppActionChannel(),
      tagChannel(),
      waitChannel(),
      responsibleChannel(),
      temperatureChannel(),
      winLossChannel(),
      filterLeadChannel(),
    ],
  },
  async ({ event, step, publish }) => {
    const workflowId = event.data.workflowId;

    if (!workflowId) {
      throw new NonRetriableError("Workflow ID is required");
    }

    // ── Detecção de modo (Modo Agente IA vs. linear legado) ──────────────
    // Workflows com `agentMode=true` rodam no DAG executor novo
    // (run-workflow.ts) com branches, loops e nós de IA. Workflows
    // antigos (agentMode=false) continuam no topo-sort linear daqui.
    const meta = await step.run("load-workflow-meta", async () => {
      const wf = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        select: { id: true, agentMode: true, isActive: true },
      });
      if (!wf.isActive) {
        throw new NonRetriableError("Workflow is inactive");
      }
      return wf;
    });

    if (meta.agentMode) {
      // Delega pro engine novo. Quando o engine encontra WAIT_FOR_EVENT,
      // ele retorna `status: "SUSPENDED"` + estado serializável; usamos
      // step.waitForEvent + step.sleep aqui pra dormir e re-invocar.
      const { runWorkflow } = await import(
        "@/features/workflows/lib/run-workflow"
      );
      const { getAgentExecutorRegistry } = await import(
        "@/features/workflows/lib/agent-executor-registry"
      );
      const rawTriggerType = (event.data as { triggerType?: string })
        .triggerType;
      // Default histórico — mantém compatibilidade com dispatches antigos,
      // mas warn-log pra pegar regressões (call-site novo que esqueceu de
      // usar dispatch* helpers de `inngest/utils.ts`). Em prod, MANUAL_TRIGGER
      // só deve vir de dispatchManualTrigger explícito.
      if (!rawTriggerType) {
        console.warn(
          `[executeWorkflow] triggerType ausente no payload — defaulting to MANUAL_TRIGGER. workflowId=${workflowId}`,
        );
      }
      const triggerType: string = rawTriggerType ?? "MANUAL_TRIGGER";
      const registry = getAgentExecutorRegistry();

      // Loop de suspend/resume — cap de 20 ciclos por workflow.
      // (cada ciclo = passou por 1 WAIT_FOR_EVENT)
      let cycles = 0;
      const MAX_RESUME_CYCLES = 20;
      let nextRunArgs: Record<string, unknown> | null = {
        workflowId,
        triggerType,
        leadId: (event.data as { leadId?: string | null }).leadId ?? null,
        triggerPayload:
          (event.data as { initialData?: Record<string, unknown> })
            .initialData ?? {},
      };
      let lastResult: unknown = null;

      while (nextRunArgs && cycles < MAX_RESUME_CYCLES) {
        cycles++;
        const stepLabel =
          cycles === 1 ? "run-agent-workflow" : `resume-agent-workflow-${cycles}`;
        const result = (await step.run(stepLabel, async () =>
          runWorkflow(nextRunArgs as never, registry),
        )) as {
          status: string;
          runId: string | null;
          suspended?: {
            runId: string;
            suspendedAtNodeId: string;
            eventName: string;
            timeoutMinutes: number;
            pendingQueue: Array<{ nodeId: string }>;
            contextSnapshot: Record<string, unknown>;
            executions: number;
            starsSpent: number;
          };
        };
        lastResult = result;

        if (result.status !== "SUSPENDED" || !result.suspended) {
          break;
        }

        // Suspendeu — espera pelo evento OU timeout.
        // step.waitForEvent retorna o evento OU null se timeout. Quando volta,
        // re-roda o engine com o estado salvo. Se for timeout, segue mesmo
        // assim pelo caminho "main" — o nó WAIT_FOR_EVENT já foi marcado
        // SUCCESS no log; o engine só continua daqui.
        const sus = result.suspended;
        // Normaliza nome do evento — convenção: "agent-workflow/<name>".
        // Permite o user configurar tanto "message-incoming" (curto)
        // quanto "agent-workflow/message-incoming" (qualificado) no nó.
        const fullEventName = sus.eventName.includes("/")
          ? sus.eventName
          : `agent-workflow/${sus.eventName}`;
        // step.waitForEvent retorna o evento que casou (com data) OU null
        // se timeout. Capturamos pra injetar no contexto — AI_DECISION
        // precisa ver `messageText` do lead pra decidir a branch.
        const resumeEvent = (await step.waitForEvent(
          `wait-event-${cycles}`,
          {
            event: fullEventName,
            timeout: `${sus.timeoutMinutes}m`,
            // Match por leadId — só acorda se evento for do mesmo lead.
            // Pra triggers org-wide sem lead específico, pulamos o match.
            ...((event.data as { leadId?: string | null }).leadId
              ? { match: "data.leadId" as const }
              : {}),
          },
        )) as { data?: Record<string, unknown> } | null;

        // Quando evento acorda o engine, injeta os campos relevantes no
        // contexto (vars.lastIncomingMessage, vars.lastEvent) pra que
        // AI_DECISION e SEND_MESSAGE possam usá-los via interpolação.
        const enrichedContext = { ...sus.contextSnapshot };
        if (resumeEvent && resumeEvent.data) {
          const vars =
            (enrichedContext.vars as Record<string, unknown> | undefined) ??
            {};
          enrichedContext.vars = {
            ...vars,
            lastEvent: resumeEvent.data,
            lastIncomingMessage:
              (resumeEvent.data as { messageText?: string }).messageText ??
              vars.lastIncomingMessage,
          };
        }

        nextRunArgs = {
          workflowId,
          triggerType,
          leadId: (event.data as { leadId?: string | null }).leadId ?? null,
          triggerPayload:
            (event.data as { initialData?: Record<string, unknown> })
              .initialData ?? {},
          resumeFromRunId: sus.runId,
          resumeQueue: sus.pendingQueue,
          resumeContext: enrichedContext,
          resumeExecutions: sus.executions,
          resumeStars: sus.starsSpent,
        };
      }

      return { workflowId, mode: "agent", cycles, result: lastResult };
    }

    // ── Caminho legado (topo-sort linear) — inalterado ──────────────────
    const sortedNodes = await step.run("prepare-workflow", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: {
          id: workflowId,
        },
        include: {
          nodes: true,
          connections: true,
        },
      });

      if (!workflow.isActive) {
        throw new NonRetriableError("Workflow is inactive");
      }

      return topologicalSort(workflow.nodes, workflow.connections);
    });

    let context = event.data.initialData || {};

    for (const node of sortedNodes) {
      const executor = getExecutor(node.type as NodeType);
      context = await executor({
        data: node.data as Record<string, unknown>,
        nodeId: node.id,
        context,
        step,
        publish,
      });
    }

    return {
      workflowId,
      mode: "linear",
      return: context,
    };
  },
);
