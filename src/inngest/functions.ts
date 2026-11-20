import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import prisma from "@/lib/prisma";
import { topologicalSort } from "./utils";
import { NodeType } from "@/generated/prisma/enums";
import { getExecutor } from "@/features/tracking-executions/lib/executor-registry";
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

/** Primeira espera curta do Fluxo de Atendimento: o que chegou no instante antes dela é visto na conferência seguinte. */
const ATTENDANCE_FIRST_WAIT_MINUTES = 1;

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    retries: 0,
    // Equipe assumiu ou tirou o lead do Fluxo de Atendimento: a espera para sem acordar (spec 0139, RF-11).
    cancelOn: [{ event: "workflow/attendance.cancel", match: "data.attendanceRunId" }],
    // Execução do Fluxo de Atendimento que quebrou não pode deixar o lead preso: as mensagens dele ficariam sem resposta.
    onFailure: async ({ event, error }) => {
      const attendanceRunId = (event.data?.event?.data as { attendanceRunId?: string } | undefined)?.attendanceRunId;
      if (!attendanceRunId) return;
      const { endAttendanceRun } = await import("@/features/attendance-flows/server/lock");
      const { flowLog } = await import("@/features/attendance-flows/lib/flow-log");
      flowLog("run.failed", { run: attendanceRunId, error: error instanceof Error ? error.message.slice(0, 200) : String(error) });
      await endAttendanceRun(attendanceRunId, "run_failed");
    },
  },
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
    const attendanceRunId = (event.data as { attendanceRunId?: string }).attendanceRunId;
    const meta = await step.run("load-workflow-meta", async () => {
      const wf = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        select: { id: true, agentMode: true, isActive: true, leadId: true, kind: true },
      });
      if (!wf.isActive) {
        if (attendanceRunId) {
          const { endAttendanceRun } = await import("@/features/attendance-flows/server/lock");
          await endAttendanceRun(attendanceRunId, "flow_removed");
        }
        throw new NonRetriableError("Workflow is inactive");
      }
      return wf;
    });

    // Escopo por lead (spec 0039, RF-7): gatilho de outro lead é ignorado.
    const eventLeadId = (event.data as { leadId?: string | null }).leadId ?? null;
    if (meta.leadId && eventLeadId && meta.leadId !== eventLeadId) {
      return { skipped: "lead_scope" };
    }

    if (meta.agentMode || meta.kind === "ATTENDANCE") {
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
      // Fluxo de atendimento conversa: cada pergunta ou resposta da IA é um ciclo (spec 0139, D-10).
      let cycles = 0;
      const MAX_RESUME_CYCLES = meta.kind === "ATTENDANCE" ? 200 : 20;
      let nextRunArgs: Record<string, unknown> | null = {
        workflowId,
        triggerType,
        leadId: (event.data as { leadId?: string | null }).leadId ?? null,
        triggerPayload:
          (event.data as { initialData?: Record<string, unknown> })
            .initialData ?? {},
        // Toque numa opção de menu salvo (spec 0098): começa pela saída daquela opção.
        ...((event.data as { startFrom?: unknown }).startFrom ? { startFrom: (event.data as { startFrom?: unknown }).startFrom } : {}),
        ...(attendanceRunId ? { attendanceRunId } : {}),
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
            /**
             * Lista de eventos que o WAIT_FOR_EVENT está escutando em race.
             * Quando o engine acorda no PRIMEIRO que chegar (Promise.race).
             * Legado: pode vir `eventName: string` em runs antigos —
             * o caller normaliza ambos pra array.
             */
            eventNames: string[];
            timeoutMinutes: number;
            pendingQueue: Array<{ nodeId: string; buttonReplyIds?: string[] }>;
            contextSnapshot: Record<string, unknown>;
            executions: number;
            starsSpent: number;
            waitKind?: "INPUT" | "TIME";
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

        type Resolved = {
          data?: Record<string, unknown>;
          name?: string;
        } | null;
        let resumeEvent: Resolved = null;
        let winningEventName = "";

        if (sus.waitKind === "TIME") {
          // Fluxo de Atendimento, bloco Atraso: espera por tempo é agendamento, não espera de evento (spec 0139, D-13).
          await step.sleep(`delay-${cycles}`, `${sus.timeoutMinutes}m`);
        } else if (sus.waitKind === "INPUT") {
          // Fluxo de Atendimento esperando o cliente. A espera do Inngest só vê mensagens que chegam depois que ela
          // começa: antes, a caixa de entrada pega a resposta que chegou enquanto o fluxo ainda enviava (D-13).
          // Um aviso que chega no instante entre conferir a caixa e começar a espera passaria despercebido: a primeira
          // espera é curta e, ao vencer, a caixa é conferida de novo antes da espera longa. A resposta usada é sempre a
          // mais antiga da caixa; o aviso só acorda (spec 0139, D-13).
          const takeReply = (stepId: string, logEvent: string) =>
            step.run(stepId, async () => {
              const { takePendingReply } = await import("@/features/attendance-flows/server/inbox");
              const { flowLog } = await import("@/features/attendance-flows/lib/flow-log");
              const reply = await takePendingReply(sus.runId);
              flowLog(reply ? logEvent : "wait.listening", { run: sus.runId, lead: leadId, timeoutMin: sus.timeoutMinutes });
              return reply ? ({ ...reply } as Record<string, unknown>) : null;
            });
          const waitForReply = async (stepId: string, minutes: number) => {
            const doorbell = (await step.waitForEvent(stepId, {
              event: "agent-workflow/message-incoming",
              timeout: `${minutes}m`,
              ...matchOpt,
            })) as Resolved;
            if (!doorbell?.data) return null;
            const reply = await takeReply(`${stepId}-take`, "wait.reply_received");
            return reply ?? doorbell.data;
          };
          const firstWaitMinutes = Math.min(ATTENDANCE_FIRST_WAIT_MINUTES, sus.timeoutMinutes);
          let reply: Record<string, unknown> | null = await takeReply(`check-inbox-${cycles}`, "wait.inbox_hit");
          if (!reply) reply = await waitForReply(`wait-input-${cycles}`, firstWaitMinutes);
          if (!reply && sus.timeoutMinutes > firstWaitMinutes) {
            reply = await takeReply(`recheck-inbox-${cycles}`, "wait.inbox_hit");
            if (!reply) reply = await waitForReply(`wait-input-rest-${cycles}`, sus.timeoutMinutes - firstWaitMinutes);
          }
          resumeEvent = reply ? { data: { ...reply }, name: "agent-workflow/message-incoming" } : null;
          winningEventName = "message-incoming";
        } else {
          // Race entre N waitForEvent. Cada um tem step id único pra Inngest
          // tratar como steps separados. Promise.race devolve o primeiro que
          // resolver (evento OU null por timeout). Quando o primeiro retorna
          // evento real, os outros viram garbage no Inngest (sem efeito).
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
          resumeEvent = winner.ev;
          winningEventName = winner.eventName.replace(
            /^agent-workflow\//,
            "",
          );

        }

        // Quando evento acorda o engine, injeta os campos relevantes no
        // contexto (vars.lastIncomingMessage, vars.lastEvent, vars.lastEventName)
        // pra que AI_DECISION + fallback heurístico + SEND_MESSAGE possam
        // usá-los via interpolação.
        const enrichedContext = { ...sus.contextSnapshot };
        // Variável nova e à parte: diz se ESTA espera venceu sem evento. As demais (`lastEvent`,
        // `lastEventName`) continuam como sempre, para não mudar fluxos que já rodam.
        enrichedContext.vars = {
          ...((enrichedContext.vars as Record<string, unknown> | undefined) ?? {}),
          lastWaitTimedOut: !(resumeEvent && resumeEvent.data),
        };
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

      // Bateu o teto de ciclos ainda esperando: solta a trava para o lead não ficar preso (CB-4).
      if (attendanceRunId && (lastResult as { status?: string } | null)?.status === "SUSPENDED") {
        await step.run("release-attendance-lock", async () => {
          const { endAttendanceRun } = await import("@/features/attendance-flows/server/lock");
          await endAttendanceRun(attendanceRunId, "expired");
        });
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

    // `workflowId` no contexto: a mensagem enviada pelo passo guarda de onde veio (spec 0113, RF-20).
    let context = { ...(event.data.initialData || {}), workflowId };

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
