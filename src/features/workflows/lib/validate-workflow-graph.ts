/**
 * Validação estrutural do grafo de workflow — complementa `validateNode`
 * (que só olha cada nó isolado). Aqui detectamos quebras de fluxo:
 *  - Nós sem entrada/saída ligadas
 *  - Triggers desconectados (cenário do bug "Agente de Agendamento")
 *  - Branches faltando aresta (AI_DECISION, SWITCH_CASE, IF_CONDITION)
 *  - MERGE com menos de 2 predecessores
 *  - WAIT_FOR_EVENT sem aresta de saída
 *  - Ciclos inseguros (delega pra `cycle-detector`)
 *  - Refs a tags arquivadas/inexistentes (TAG action + LEAD_TAGGED trigger)
 *
 * Roda no servidor — precisa do banco pra resolver refs externas.
 */
import prisma from "@/lib/prisma";
import { isTriggerNode } from "./validate-node";
import { detectCycles } from "./cycle-detector";

export type GraphIssueSeverity = "error" | "warning";

export type GraphIssue = {
  /** null = problema do workflow inteiro (sem nó específico) */
  nodeId: string | null;
  severity: GraphIssueSeverity;
  /** Código estável pra agrupar/filtrar na UI */
  code:
    | "NO_TRIGGER"
    | "TRIGGER_DISCONNECTED"
    | "ORPHAN_NODE"
    | "UNREACHABLE_NODE"
    | "AI_DECISION_MISSING_BRANCH"
    | "SWITCH_CASE_MISSING_BRANCH"
    | "IF_CONDITION_MISSING_OUTPUT"
    | "MERGE_UNDER_FED"
    | "WAIT_FOR_EVENT_DEAD_END"
    | "CYCLE_UNSAFE"
    | "ARCHIVED_TAG"
    | "DELETED_TAG";
  message: string;
};

export type GraphValidation = {
  valid: boolean;
  issues: GraphIssue[];
};

type GraphNode = {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
};

type GraphConn = {
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string | null;
};

function unwrapAction(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const d = data ?? {};
  if (d.action && typeof d.action === "object" && !Array.isArray(d.action)) {
    return d.action as Record<string, unknown>;
  }
  return d;
}

/** Extrai tagIds de qualquer node TAG (action) ou LEAD_TAGGED (trigger). */
function extractTagIds(node: GraphNode): string[] {
  const action = unwrapAction(node.data);
  const raw = action.tagIds;
  return Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === "string")
    : [];
}

/** Roda só os checks síncronos (sem hit no banco) — útil pro client-side. */
export function validateWorkflowGraphSync(args: {
  nodes: GraphNode[];
  connections: GraphConn[];
}): GraphValidation {
  const { nodes, connections } = args;
  const issues: GraphIssue[] = [];

  if (nodes.length === 0) {
    issues.push({
      nodeId: null,
      severity: "error",
      code: "NO_TRIGGER",
      message: "Workflow vazio — adicione pelo menos um nó de gatilho.",
    });
    return { valid: false, issues };
  }

  // ── Adjacência ──────────────────────────────────────────────────────
  const outByNode = new Map<string, GraphConn[]>();
  const inByNode = new Map<string, GraphConn[]>();
  for (const c of connections) {
    if (!outByNode.has(c.fromNodeId)) outByNode.set(c.fromNodeId, []);
    if (!inByNode.has(c.toNodeId)) inByNode.set(c.toNodeId, []);
    outByNode.get(c.fromNodeId)!.push(c);
    inByNode.get(c.toNodeId)!.push(c);
  }

  // ── NO_TRIGGER ──────────────────────────────────────────────────────
  const triggers = nodes.filter((n) => isTriggerNode(n.type));
  if (triggers.length === 0) {
    issues.push({
      nodeId: null,
      severity: "error",
      code: "NO_TRIGGER",
      message:
        "Workflow não tem nenhum gatilho. Adicione um nó NEW_LEAD, LEAD_TAGGED, MOVE_LEAD_STATUS ou MANUAL_TRIGGER.",
    });
  }

  // ── TRIGGER_DISCONNECTED ────────────────────────────────────────────
  for (const t of triggers) {
    const outs = outByNode.get(t.id) ?? [];
    if (outs.length === 0) {
      issues.push({
        nodeId: t.id,
        severity: "error",
        code: "TRIGGER_DISCONNECTED",
        message: `Gatilho ${t.type} sem nenhuma ação conectada. Arraste uma seta da saída pro próximo nó.`,
      });
    }
  }

  // ── ORPHAN_NODE / UNREACHABLE_NODE ──────────────────────────────────
  // BFS a partir dos triggers pra marcar alcançáveis
  const reachable = new Set<string>();
  const queue: string[] = triggers.map((t) => t.id);
  for (const id of queue) reachable.add(id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of outByNode.get(id) ?? []) {
      if (!reachable.has(e.toNodeId)) {
        reachable.add(e.toNodeId);
        queue.push(e.toNodeId);
      }
    }
  }
  for (const n of nodes) {
    if (isTriggerNode(n.type)) continue;
    const hasIn = (inByNode.get(n.id) ?? []).length > 0;
    const hasOut = (outByNode.get(n.id) ?? []).length > 0;
    if (!hasIn && !hasOut) {
      issues.push({
        nodeId: n.id,
        severity: "error",
        code: "ORPHAN_NODE",
        message: `Nó ${n.type} solto — não tem entrada nem saída. Conecte ou remova.`,
      });
    } else if (hasIn && !reachable.has(n.id)) {
      issues.push({
        nodeId: n.id,
        severity: "warning",
        code: "UNREACHABLE_NODE",
        message: `Nó ${n.type} não é alcançável a partir de nenhum gatilho — nunca vai executar.`,
      });
    }
  }

  // ── AI_DECISION_MISSING_BRANCH ──────────────────────────────────────
  for (const n of nodes) {
    if (n.type !== "AI_DECISION") continue;
    const branches = (n.data as { branches?: Array<{ id: string; label?: string }> } | null)
      ?.branches;
    if (!Array.isArray(branches) || branches.length === 0) continue;
    const outputs = new Set(
      (outByNode.get(n.id) ?? []).map((c) => c.fromOutput ?? "main"),
    );
    const missing = branches.filter((b) => !outputs.has(b.id));
    if (missing.length > 0) {
      issues.push({
        nodeId: n.id,
        severity: "error",
        code: "AI_DECISION_MISSING_BRANCH",
        message: `AI_DECISION com ${missing.length} branch(es) sem conexão: ${missing.map((m) => m.label ?? m.id).join(", ")}. Cada branch precisa de uma seta saindo.`,
      });
    }
  }

  // ── SWITCH_CASE_MISSING_BRANCH ──────────────────────────────────────
  for (const n of nodes) {
    if (n.type !== "SWITCH_CASE") continue;
    const action = unwrapAction(n.data);
    const cases = (action.cases ?? action.branches) as
      | Array<{ id?: string; value?: string; label?: string }>
      | undefined;
    if (!Array.isArray(cases) || cases.length === 0) continue;
    const outputs = new Set(
      (outByNode.get(n.id) ?? []).map((c) => c.fromOutput ?? "main"),
    );
    const missing = cases.filter(
      (c) => !outputs.has(c.id ?? c.value ?? ""),
    );
    if (missing.length > 0) {
      issues.push({
        nodeId: n.id,
        severity: "error",
        code: "SWITCH_CASE_MISSING_BRANCH",
        message: `SWITCH_CASE com ${missing.length} caso(s) sem conexão.`,
      });
    }
  }

  // ── IF_CONDITION_MISSING_OUTPUT ─────────────────────────────────────
  for (const n of nodes) {
    if (n.type !== "IF_CONDITION") continue;
    const outputs = new Set(
      (outByNode.get(n.id) ?? []).map((c) => c.fromOutput ?? "main"),
    );
    const missing: string[] = [];
    if (!outputs.has("true")) missing.push("true");
    if (!outputs.has("false")) missing.push("false");
    if (missing.length > 0) {
      issues.push({
        nodeId: n.id,
        severity: "warning",
        code: "IF_CONDITION_MISSING_OUTPUT",
        message: `IF sem saída no(s) ramo(s) [${missing.join(", ")}] — fluxo termina nesse caminho.`,
      });
    }
  }

  // ── MERGE_UNDER_FED ─────────────────────────────────────────────────
  for (const n of nodes) {
    if (n.type !== "MERGE") continue;
    const ins = (inByNode.get(n.id) ?? []).length;
    if (ins < 2) {
      issues.push({
        nodeId: n.id,
        severity: "warning",
        code: "MERGE_UNDER_FED",
        message: `MERGE com ${ins} entrada(s) — esse nó só faz sentido com 2+ caminhos chegando.`,
      });
    }
  }

  // ── WAIT_FOR_EVENT_DEAD_END ─────────────────────────────────────────
  for (const n of nodes) {
    if (n.type !== "WAIT_FOR_EVENT") continue;
    const outs = (outByNode.get(n.id) ?? []).length;
    if (outs === 0) {
      issues.push({
        nodeId: n.id,
        severity: "warning",
        code: "WAIT_FOR_EVENT_DEAD_END",
        message: `WAIT_FOR_EVENT sem nenhum nó depois — o workflow vai dormir e nunca continuar.`,
      });
    }
  }

  // ── CYCLE_UNSAFE ────────────────────────────────────────────────────
  const cycleReport = detectCycles(
    nodes.map((n) => ({ id: n.id, type: n.type })),
    connections.map((c) => ({ fromNodeId: c.fromNodeId, toNodeId: c.toNodeId })),
  );
  for (const cycle of cycleReport.unsafeCycles) {
    issues.push({
      nodeId: cycle[0] ?? null,
      severity: "error",
      code: "CYCLE_UNSAFE",
      message: `Loop infinito entre [${cycle.join(", ")}] — adicione IF/SWITCH/LOOP/WAIT no caminho com critério de parada.`,
    });
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

/**
 * Validação completa — síncrona + checks de refs externas (tags arquivadas/
 * deletadas). Use no servidor.
 */
export async function validateWorkflowGraph(
  workflowId: string,
): Promise<GraphValidation> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      nodes: { select: { id: true, type: true, data: true } },
      connections: {
        select: { fromNodeId: true, toNodeId: true, fromOutput: true },
      },
    },
  });

  if (!workflow) {
    return {
      valid: false,
      issues: [
        {
          nodeId: null,
          severity: "error",
          code: "NO_TRIGGER",
          message: "Workflow não encontrado.",
        },
      ],
    };
  }

  const nodes = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data as Record<string, unknown> | null,
  }));
  const connections = workflow.connections.map((c) => ({
    fromNodeId: c.fromNodeId,
    toNodeId: c.toNodeId,
    fromOutput: c.fromOutput,
  }));

  const sync = validateWorkflowGraphSync({ nodes, connections });
  const issues = [...sync.issues];

  // ── Refs externas: tags arquivadas/deletadas ───────────────────────
  const tagNodes = nodes.filter(
    (n) => n.type === "TAG" || n.type === "LEAD_TAGGED",
  );
  const allTagIds = new Set<string>();
  const tagIdToNodes = new Map<string, string[]>();
  for (const n of tagNodes) {
    for (const tagId of extractTagIds(n)) {
      allTagIds.add(tagId);
      if (!tagIdToNodes.has(tagId)) tagIdToNodes.set(tagId, []);
      tagIdToNodes.get(tagId)!.push(n.id);
    }
  }
  if (allTagIds.size > 0) {
    const foundTags = await prisma.tag.findMany({
      where: { id: { in: [...allTagIds] } },
      select: { id: true, name: true, archivedAt: true },
    });
    const foundById = new Map(foundTags.map((t) => [t.id, t]));
    for (const tagId of allTagIds) {
      const tag = foundById.get(tagId);
      const nodeIds = tagIdToNodes.get(tagId) ?? [];
      if (!tag) {
        for (const nid of nodeIds) {
          issues.push({
            nodeId: nid,
            severity: "error",
            code: "DELETED_TAG",
            message: `Esse nó referencia uma tag (${tagId}) que foi deletada.`,
          });
        }
      } else if (tag.archivedAt) {
        for (const nid of nodeIds) {
          issues.push({
            nodeId: nid,
            severity: "warning",
            code: "ARCHIVED_TAG",
            message: `Tag "${tag.name}" está arquivada — workflow ainda dispara, mas a tag não aparece em pickers/novos eventos.`,
          });
        }
      }
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}
