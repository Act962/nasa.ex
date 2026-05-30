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

        // Suspendeu — espera pelo PRIMEIRO de N eventos OU timeout.
        // Quando o engine quer aceitar múltiplos eventos (proposta + texto +
        // tag aplicada manual, p.ex.), disparamos N `step.waitForEvent` em
        // paralelo e damos `Promise.race` — quem chegar primeiro acorda o
        // engine. Se for timeout, todos os waits retornam null e seguimos
        // pelo caminho "main".
        //
        // Convenção: nomes curtos como "message-incoming" são qualificados
        // pra "agent-workflow/message-incoming" automaticamente.
        const sus = result.suspended;
        const eventNames = sus.eventNames ?? [];
        const fullEventNames = eventNames.map((n) =>
          n.includes("/") ? n : `agent-workflow/${n}`,
        );
        const leadId = (event.data as { leadId?: string | null }).leadId;
        const matchOpt = leadId
          ? { match: "data.leadId" as const }
          : ({} as Record<string, never>);

        // Race entre N waitForEvent. Cada um tem step id único pra Inngest
        // tratar como steps separados. Promise.race devolve o primeiro que
        // resolver (evento OU null por timeout). Quando o primeiro retorna
        // evento real, os outros viram garbage no Inngest (sem efeito).
        type Resolved = {
          data?: Record<string, unknown>;
          name?: string;
        } | null;
        const waitPromises = fullEventNames.map((eventName, idx) =>
          (
            step.waitForEvent(`wait-event-${cycles}-${idx}`, {
              event: eventName,
              timeout: `${sus.timeoutMinutes}m`,
              ...matchOpt,
            }) as Promise<Resolved>
          ).then((ev) => ({ ev, eventName })),
        );
        // Promise.race retorna o primeiro a resolver — pode ser null (timeout)
        // ou um evento. Se for null, igual ao Promise.all teria retornado
        // todos null (mesmo timeout pros N), então não perdemos nada.
        const winner = await Promise.race(waitPromises);
        const resumeEvent = winner.ev;
        const winningEventName = winner.eventName.replace(
          /^agent-workflow\//,
          "",
        );

        // Quando evento acorda o engine, injeta os campos relevantes no
        // contexto (vars.lastIncomingMessage, vars.lastEvent, vars.lastEventName)
        // pra que AI_DECISION + fallback heurístico + SEND_MESSAGE possam
        // usá-los via interpolação.
        const enrichedContext = { ...sus.contextSnapshot };
        if (resumeEvent && resumeEvent.data) {
          const vars =
            (enrichedContext.vars as Record<string, unknown> | undefined) ??
            {};
          enrichedContext.vars = {
            ...vars,
            lastEvent: resumeEvent.data,
            lastEventName: winningEventName,
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
