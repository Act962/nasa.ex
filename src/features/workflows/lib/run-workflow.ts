/**
 * Engine de execução do Modo Agente IA — DAG executor com fan-out por
 * `Connection.fromOutput`. Substitui o topo-sort linear do
 * `workspace-workflow-executor.ts` quando `Workflow.agentMode = true`.
 *
 * Capacidades:
 *  - Multi-trigger (N nodes de trigger num só workflow)
 *  - Branches condicionais (IF_CONDITION → "true" | "false")
 *  - Switch multi-output (SWITCH_CASE → "case_<X>")
 *  - Loops (LOOP_OVER → "loop" / "done", cap maxIterations)
 *  - AI Decision (Astro escolhe branch baseado em contexto)
 *  - Wait-for-event (sleep até evento Inngest específico)
 *  - Sub-workflows (CALL_WORKFLOW)
 *  - Cap absoluto de 100 node-executions por run (defesa contra loop)
 *  - Persistência de WorkflowRun + WorkflowNodeRun pra auditoria
 *  - Dry-run mode: simula sem disparar side-effects
 *
 * Esta é a função pura que monta a sequência de execução — os SIDE-EFFECTS
 * de cada node-execution (enviar msg, chamar Stripe, etc) são delegados ao
 * `executor-registry.ts` existente (Fase 2 estende com os novos NodeTypes).
 */
import prisma from "@/lib/prisma";
import {
  createInitialContext,
  evaluateConditionGroup,
  getByPath,
  type Condition,
  type WorkflowContext,
} from "./workflow-context";
import { MAX_EXECUTIONS_PER_RUN } from "./cycle-detector";

// ─── Types ─────────────────────────────────────────

export type RunWorkflowInput = {
  workflowId: string;
  triggerType: string;
  /** Lead/contexto inicial. Pode vir vazio em workflows org-wide. */
  leadId?: string | null;
  /** Snapshot do payload do evento que disparou o trigger. */
  triggerPayload?: Record<string, unknown>;
  /** Variáveis pré-populadas (passadas pelo caller). */
  initialVars?: Record<string, unknown>;
  /** Se true: simula sem disparar side-effects nem cobrar Stars. */
  dryRun?: boolean;
  /**
   * Resume de um suspend anterior. Quando o run-workflow encontra um nó
   * WAIT_FOR_EVENT, ele retorna `status: "SUSPENDED"` + `suspendedAt` +
   * `pendingQueue`. O caller (executeWorkflow Inngest) chama
   * `step.waitForEvent` ou `step.sleep` e depois re-invoca runWorkflow
   * passando esses campos pra continuar do ponto.
   */
  resumeFromRunId?: string;
  resumeQueue?: Array<{ nodeId: string }>;
  resumeContext?: WorkflowContext;
  resumeExecutions?: number;
  resumeStars?: number;
};

/**
 * Estado serializável retornado quando o workflow suspende em
 * WAIT_FOR_EVENT. Caller usa pra retomar via `resumeFromRunId`.
 */
export type SuspendedState = {
  runId: string;
  suspendedAtNodeId: string;
  eventName: string;
  timeoutMinutes: number;
  /** Nodes que ainda precisam ser executados após o resume. */
  pendingQueue: Array<{ nodeId: string }>;
  /** Contexto serializado pra reidratar no resume. */
  contextSnapshot: WorkflowContext;
  executions: number;
  starsSpent: number;
};

export type NodeExecutionResult = {
  /** Output do node passado adiante via mergeOutput. */
  output: unknown;
  /** Branch escolhida (IF/SWITCH/LOOP/AI_DECISION). Default "main". */
  chosenOutput?: string;
  /** Stars cobrados (executor de cada node informa). */
  starsSpent?: number;
  /** Status SUCCESS|FAILED|SKIPPED|WAITING. */
  status?: "SUCCESS" | "FAILED" | "SKIPPED" | "WAITING";
  errorMessage?: string;
};

/** Assinatura que cada node-executor deve respeitar. */
export type NodeExecutor = (params: {
  nodeId: string;
  nodeType: string;
  data: Record<string, unknown>;
  context: WorkflowContext;
  dryRun: boolean;
}) => Promise<NodeExecutionResult>;

// ─── Engine ────────────────────────────────────────

type GraphNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};
type GraphEdge = {
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string;
  toInput: string;
};

/**
 * Executor principal. Carrega workflow, encontra triggers que casam com o
 * evento, executa cada caminho do DAG respeitando branches/loops/cycle cap.
 */
export async function runWorkflow(
  input: RunWorkflowInput,
  executors: Map<string, NodeExecutor>,
) {
  const {
    workflowId,
    triggerType,
    leadId,
    triggerPayload,
    initialVars,
    dryRun = false,
    resumeFromRunId,
    resumeQueue,
    resumeContext,
    resumeExecutions,
    resumeStars,
  } = input;
  const isResume = !!resumeFromRunId && !!resumeQueue;

  // 1. Carrega workflow + nodes + connections
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { nodes: true, connections: true },
  });
  if (!workflow) throw new Error(`Workflow ${workflowId} não encontrado`);
  if (!workflow.isActive && !dryRun) {
    return { runId: null, status: "SKIPPED", reason: "workflow_inactive" };
  }
  if (!workflow.agentMode) {
    throw new Error(
      `Workflow ${workflowId} não está em Modo Agente IA — use o executor antigo (workspace-workflow-executor).`,
    );
  }

  // 2. Rate limit (cap maxRunsPerHour) — só pra runs reais
  if (!dryRun) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRuns = await prisma.workflowRun.count({
      where: {
        workflowId,
        startedAt: { gte: oneHourAgo },
        status: { in: ["RUNNING", "SUCCESS"] },
      },
    });
    if (recentRuns >= workflow.maxRunsPerHour) {
      return {
        runId: null,
        status: "RATE_LIMITED",
        reason: `Limite de ${workflow.maxRunsPerHour} execuções/hora atingido.`,
      };
    }
  }

  // 3. Carrega lead (se houver) pra contexto
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : null;

  // 4. Cria WorkflowRun (ou reusa o anterior se for resume)
  const run = dryRun
    ? { id: `dry-${Date.now()}` }
    : isResume
      ? { id: resumeFromRunId! }
      : await prisma.workflowRun.create({
          data: {
            workflowId,
            leadId: leadId ?? null,
            triggerType,
            // Round-trip JSON garante plain objects — Inngest pode entregar
            // objetos com prototype chain quebrado, e Prisma 7 rejeita ao
            // achar "constructor" no objeto. Round-trip elimina qualquer
            // propriedade não-enumerável.
            initialContext: JSON.parse(
              JSON.stringify({
                lead: lead ? sanitizeForJson(lead) : null,
                trigger: triggerPayload ?? null,
                vars: initialVars ?? null,
              }),
            ),
            status: "RUNNING",
          },
          select: { id: true },
        });

  // Resume: re-marca como RUNNING (estava SUSPENDED) — caller já validou status
  if (isResume && !dryRun) {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "RUNNING" },
    });
  }

  // 5. Encontra trigger-nodes que casam com triggerType
  const triggerNodes = workflow.nodes.filter((n) => n.type === triggerType);
  if (triggerNodes.length === 0) {
    // Lista os triggers que o workflow tem, pra mensagem ajudar o operador
    // a entender o mismatch (ex: dispatch enviou MANUAL_TRIGGER mas o
    // workflow só tem LEAD_TAGGED — bug clássico de dispatch sem helper).
    const availableTriggers = [
      ...new Set(
        workflow.nodes
          .filter((n) => /TRIGGER|NEW_LEAD|LEAD_TAGGED|MOVE_LEAD_STATUS|AI_FINISHED|FIRST_CHAT_INTERACTION|LAST_INBOUND_TIMEOUT|PAYMENT_RECEIVED|MESSAGE_INCOMING|WEBHOOK_EXTERNAL|INITIAL|WS_/.test(n.type))
          .map((n) => n.type),
      ),
    ];
    const errorMessage =
      availableTriggers.length === 0
        ? `Nenhum trigger node do tipo ${triggerType} no workflow. O workflow não tem nenhum trigger configurado — adicione um nó de gatilho (NEW_LEAD, LEAD_TAGGED, etc).`
        : `Nenhum trigger node do tipo ${triggerType} no workflow. Triggers disponíveis: [${availableTriggers.join(", ")}]. Quem disparou esse run provavelmente esqueceu de usar o helper dispatch* correto em inngest/utils.ts.`;
    if (!dryRun) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage,
          finishedAt: new Date(),
        },
      });
    }
    return { runId: run.id, status: "FAILED", reason: "no_matching_trigger" };
  }

  // 6. Monta adjacência indexada por fromOutput
  const edges: GraphEdge[] = workflow.connections.map((c) => ({
    fromNodeId: c.fromNodeId,
    toNodeId: c.toNodeId,
    fromOutput: c.fromOutput ?? "main",
    toInput: c.toInput ?? "main",
  }));
  const adjBy = new Map<string, Map<string, string[]>>(); // nodeId → output → toNodeIds[]
  for (const e of edges) {
    if (!adjBy.has(e.fromNodeId)) adjBy.set(e.fromNodeId, new Map());
    const byOut = adjBy.get(e.fromNodeId)!;
    if (!byOut.has(e.fromOutput)) byOut.set(e.fromOutput, []);
    byOut.get(e.fromOutput)!.push(e.toNodeId);
  }
  const nodeById = new Map<string, GraphNode>(
    workflow.nodes.map((n) => [
      n.id,
      {
        id: n.id,
        type: n.type,
        data: (n.data as Record<string, unknown>) ?? {},
      },
    ]),
  );

  // 7. Executa caminhos. Resume reidrata estado; nova execução inicia do trigger.
  let ctx: WorkflowContext = isResume
    ? resumeContext!
    : createInitialContext({
        lead: lead ? sanitizeForJson(lead) : undefined,
        trigger: triggerPayload,
        initialVars,
      });
  let executions = isResume ? resumeExecutions ?? 0 : 0;
  let totalStars = isResume ? resumeStars ?? 0 : 0;
  const log: Array<{
    nodeId: string;
    type: string;
    chosenOutput: string;
    output: unknown;
    status: string;
    errorMessage?: string;
  }> = [];

  // Queue de pares (nodeId, contexto-no-momento). BFS pra evitar recursão profunda.
  const queue: Array<{ nodeId: string }> = isResume
    ? resumeQueue!
    : triggerNodes.map((n) => ({ nodeId: n.id }));

  while (queue.length > 0) {
    if (executions >= MAX_EXECUTIONS_PER_RUN) {
      log.push({
        nodeId: "<engine>",
        type: "ENGINE",
        chosenOutput: "main",
        output: null,
        status: "FAILED",
        errorMessage: `Cap de ${MAX_EXECUTIONS_PER_RUN} node-executions atingido — possível loop infinito.`,
      });
      if (!dryRun) {
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "MAX_EXECUTIONS_HIT",
            nodesExecuted: executions,
            starsSpent: totalStars,
            errorMessage: `Cap de ${MAX_EXECUTIONS_PER_RUN} execuções atingido.`,
            finishedAt: new Date(),
          },
        });
      }
      return {
        runId: run.id,
        status: "MAX_EXECUTIONS_HIT",
        executions,
        starsSpent: totalStars,
        log,
      };
    }

    const cur = queue.shift()!;
    const node = nodeById.get(cur.nodeId);
    if (!node) continue;

    executions++;
    const result = await executeNode({
      node,
      context: ctx,
      executors,
      dryRun,
    });

    log.push({
      nodeId: node.id,
      type: node.type,
      chosenOutput: result.chosenOutput ?? "main",
      output: result.output,
      status: result.status ?? "SUCCESS",
      errorMessage: result.errorMessage,
    });

    if (!dryRun) {
      await prisma.workflowNodeRun.create({
        data: {
          runId: run.id,
          nodeId: node.id,
          nodeType: node.type,
          chosenOutput: result.chosenOutput ?? "main",
          output: sanitizeForJson(result.output ?? {}),
          status: result.status ?? "SUCCESS",
          errorMessage: result.errorMessage,
          finishedAt: new Date(),
        },
      });
    }

    if (result.status === "FAILED") {
      // Erro num node não derruba todo workflow — segue tentando outras branches paralelas.
      // Se quiser parar: adicionar `breakOnError` em Workflow no futuro.
      continue;
    }

    // ── WAIT_FOR_EVENT: suspende run e devolve estado pro caller ─────────
    // Caller (executeWorkflow Inngest function) usa step.waitForEvent +
    // step.sleep com `timeoutMinutes` e depois re-invoca runWorkflow com
    // `resumeFromRunId/resumeQueue/resumeContext`. Funciona em dry-run
    // também (só pula a parte de persistir o suspend).
    if (result.status === "WAITING" && !dryRun) {
      // Enfileira o próximo nó (saída "main" depois do WAIT) pra rodar no resume
      const byOutWait = adjBy.get(node.id);
      const nextAfterWait: Array<{ nodeId: string }> = [];
      if (byOutWait) {
        for (const nextId of byOutWait.get("main") ?? []) {
          nextAfterWait.push({ nodeId: nextId });
        }
      }
      const remainingQueue = [...nextAfterWait, ...queue];
      const pendingCtx = mergeOutputInto(ctx, node.id, result.output);

      // Prioriza valores que o executor retornou no output (caso do nó WAIT
      // que define eventName/timeout dinâmicos baseados em data.action.days).
      // Cai pra node.data quando o executor não devolveu (WAIT_FOR_EVENT).
      const outputObj =
        (result.output && typeof result.output === "object"
          ? (result.output as Record<string, unknown>)
          : {}) ?? {};
      const eventName = String(
        outputObj.eventName ??
          (node.data.eventName as string | undefined) ??
          "message-incoming",
      );
      const timeoutMinutes = Number(
        outputObj.timeoutMinutes ??
          (node.data.timeoutMinutes as number | undefined) ??
          1440,
      );

      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: "SUSPENDED",
          nodesExecuted: executions,
          starsSpent: totalStars,
          errorMessage: `Aguardando evento "${eventName}" (timeout ${timeoutMinutes} min)`,
        },
      });

      return {
        runId: run.id,
        status: "SUSPENDED",
        executions,
        starsSpent: totalStars,
        log,
        suspended: {
          runId: run.id,
          suspendedAtNodeId: node.id,
          eventName,
          timeoutMinutes,
          pendingQueue: remainingQueue,
          contextSnapshot: pendingCtx,
          executions,
          starsSpent: totalStars,
        } as SuspendedState,
      };
    }

    totalStars += result.starsSpent ?? 0;
    ctx = mergeOutputInto(ctx, node.id, result.output);

    // Enfileira próximos nodes pela branch escolhida
    const chosen = result.chosenOutput ?? "main";
    const byOut = adjBy.get(node.id);
    if (!byOut) continue;

    // "main" sempre dispara (para nodes sem branches semânticas)
    const fanoutOutputs: string[] = chosen === "main" ? ["main"] : [chosen];
    // Nodes podem ter outputs paralelos sempre disparados (futuro)

    for (const out of fanoutOutputs) {
      const nexts = byOut.get(out);
      if (!nexts) continue;
      for (const next of nexts) {
        queue.push({ nodeId: next });
      }
    }
  }

  if (!dryRun) {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        nodesExecuted: executions,
        starsSpent: totalStars,
        finishedAt: new Date(),
      },
    });
  }

  return {
    runId: run.id,
    status: dryRun ? "DRY_RUN" : "SUCCESS",
    executions,
    starsSpent: totalStars,
    log,
  };
}

// ─── Helpers ───────────────────────────────────────

async function executeNode(params: {
  node: GraphNode;
  context: WorkflowContext;
  executors: Map<string, NodeExecutor>;
  dryRun: boolean;
}): Promise<NodeExecutionResult> {
  const { node, context, executors, dryRun } = params;

  // Trigger nodes são pontos de entrada — não têm executor. Engine só
  // enfileira os próximos nodes (saída "main") e segue. Lista cobre tanto
  // os triggers clássicos quanto os do Modo Agente IA.
  if (
    node.type === "INITIAL" ||
    node.type === "MANUAL_TRIGGER" ||
    node.type === "NEW_LEAD" ||
    node.type === "MOVE_LEAD_STATUS" ||
    node.type === "LEAD_TAGGED" ||
    node.type === "AI_FINISHED" ||
    node.type === "FIRST_CHAT_INTERACTION" ||
    node.type === "LAST_INBOUND_TIMEOUT" ||
    node.type === "PAYMENT_RECEIVED" ||
    node.type === "MESSAGE_INCOMING" ||
    node.type === "WEBHOOK_EXTERNAL" ||
    node.type === "WS_INITIAL" ||
    node.type === "WS_MANUAL_TRIGGER" ||
    node.type === "WS_ACTION_CREATED" ||
    node.type === "WS_ACTION_MOVED_COLUMN" ||
    node.type === "WS_ACTION_TAGGED" ||
    node.type === "WS_ACTION_COMPLETED" ||
    node.type === "WS_ACTION_PARTICIPANT_ADDED"
  ) {
    return {
      output: { triggered: true, triggerType: node.type },
      chosenOutput: "main",
      status: "SUCCESS",
    };
  }

  // Built-in: nodes de lógica não precisam de executor externo
  switch (node.type) {
    case "IF_CONDITION": {
      const conditions = (node.data.conditions as Condition[]) ?? [];
      const combinator = (node.data.combinator as "AND" | "OR") ?? "AND";
      const result = evaluateConditionGroup(context, conditions, combinator);
      return {
        output: { passed: result },
        chosenOutput: result ? "true" : "false",
      };
    }

    case "SWITCH_CASE": {
      const field = String(node.data.field ?? "");
      const cases = (node.data.cases as Array<{ value: unknown; output: string }>) ?? [];
      const val = getByPath(context, field);
      const match = cases.find((c) => c.value === val);
      return {
        output: { matched: !!match, value: val },
        chosenOutput: match ? match.output : "default",
      };
    }

    case "LOOP_OVER": {
      const arrayPath = String(node.data.arrayPath ?? "");
      const maxIter = Number(node.data.maxIterations ?? 10);
      const items = getByPath(context, arrayPath);
      const arr = Array.isArray(items) ? items.slice(0, maxIter) : [];
      // No engine BFS, LOOP_OVER se traduz: itera arr e enfileira a branch "loop"
      // pra cada item. Implementação completa de loop com contexto isolado por
      // iteração fica pra Fase 2 (vai precisar de queue com contexto por item).
      // Por ora dispara "done" quando array vazio ou esgotou.
      if (arr.length === 0) {
        return { output: { count: 0 }, chosenOutput: "done" };
      }
      // Marca primeiro item; iteração completa será wireada no run-workflow
      // quando refatorarmos pra suportar contexto por branch (Fase 2).
      return {
        output: { count: arr.length, items: arr },
        chosenOutput: "loop",
      };
    }

    case "MERGE":
      return { output: { mergedFromNodes: Object.keys(context.nodeOutputs) } };

    case "WAIT": {
      // Nó "Esperar" do tracking (não confundir com WAIT_FOR_EVENT).
      // data.action.{type: minutes|hours|days|weeks, [unit]: N}
      // Usa o mesmo mecanismo do WAIT_FOR_EVENT: retorna WAITING + nome
      // de evento que ninguém publica → o caller (Inngest) dorme via
      // step.waitForEvent com timeout = N minutos e segue após.
      const action =
        (node.data.action && typeof node.data.action === "object"
          ? (node.data.action as Record<string, unknown>)
          : node.data) ?? {};
      const unit = String(action.type ?? action.unit ?? "minutes");
      const minutes =
        unit === "weeks"
          ? Number(action.weeks ?? 0) * 60 * 24 * 7
          : unit === "days"
            ? Number(action.days ?? 0) * 60 * 24
            : unit === "hours"
              ? Number(action.hours ?? 0) * 60
              : Number(action.minutes ?? 0);
      if (dryRun) {
        return { output: { dryRun: true, willWaitMinutes: minutes } };
      }
      if (minutes <= 0) {
        return {
          output: { warning: "WAIT com tempo zero — seguindo direto" },
          chosenOutput: "main",
        };
      }
      // Suspende com timeout — usa eventName placeholder que ninguém
      // publica, então só o timeout faz o engine continuar.
      return {
        output: {
          waiting: true,
          waitMinutes: minutes,
          eventName: "__wait-timer__",
          timeoutMinutes: minutes,
        },
        chosenOutput: "main",
        status: "WAITING",
      };
    }

    case "SET_VARIABLE": {
      const name = String(node.data.name ?? "");
      const value =
        node.data.value !== undefined
          ? node.data.value
          : node.data.expression
            ? getByPath(context, String(node.data.expression))
            : undefined;
      return {
        output: { vars: { [name]: value } },
      };
    }

    default: {
      // Demais nodes: delega pro executor registrado
      const executor = executors.get(node.type);
      if (!executor) {
        return {
          output: null,
          status: "FAILED",
          errorMessage: `Sem executor registrado pro NodeType ${node.type}.`,
        };
      }
      try {
        return await executor({
          nodeId: node.id,
          nodeType: node.type,
          data: node.data,
          context,
          dryRun,
        });
      } catch (err) {
        return {
          output: null,
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
}

function mergeOutputInto(
  ctx: WorkflowContext,
  nodeId: string,
  output: unknown,
): WorkflowContext {
  const next: WorkflowContext = {
    ...ctx,
    nodeOutputs: { ...ctx.nodeOutputs, [nodeId]: output },
  };
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const o = output as Record<string, unknown>;
    if (o.vars && typeof o.vars === "object" && !Array.isArray(o.vars)) {
      next.vars = { ...ctx.vars, ...(o.vars as Record<string, unknown>) };
    }
    if (o.lead && typeof o.lead === "object" && !Array.isArray(o.lead)) {
      next.lead = { ...(ctx.lead ?? {}), ...(o.lead as Record<string, unknown>) };
    }
  }
  return next;
}

/** Remove campos não-serializáveis (Date → ISO, BigInt → string) pra Prisma JSON. */
function sanitizeForJson(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForJson(v);
    }
    return out;
  }
  return value;
}
