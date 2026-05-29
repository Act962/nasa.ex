/**
 * Detector de ciclos pro Modo Agente IA. Workflows N8n-style podem ter
 * arestas que voltam a um node anterior (loop) — mas só se houver um nó
 * de controle no caminho (IF_CONDITION / SWITCH_CASE / LOOP_OVER) com
 * critério de parada. Sem isso, o workflow vira infinito.
 *
 * Duas camadas de defesa:
 *  1. Estática (este arquivo) — roda no save do workflow. Bloqueia se
 *     algum ciclo não tem nó de controle.
 *  2. Runtime (run-workflow.ts) — cap absoluto de `MAX_EXECUTIONS_PER_RUN`
 *     mesmo que (1) passe por bug.
 */

const CONTROL_NODE_TYPES = new Set([
  "IF_CONDITION",
  "SWITCH_CASE",
  "LOOP_OVER",
  "WAIT_FOR_EVENT",
  "AI_DECISION",
  // FILTER_LEAD legado também serve como saída condicional
  "FILTER_LEAD",
]);

export type GraphNode = { id: string; type: string };
export type GraphEdge = { fromNodeId: string; toNodeId: string };

export type CycleReport = {
  /** true = grafo seguro pra salvar (sem ciclos OU ciclos têm controle). */
  safe: boolean;
  /** Ciclos encontrados (cada um é lista de node IDs na ordem da aresta). */
  cycles: string[][];
  /** Ciclos perigosos (sem nó de controle). */
  unsafeCycles: string[][];
  /** Mensagens prontas pra UI. */
  warnings: string[];
};

/**
 * Tarjan's strongly connected components — encontra todos os ciclos do DAG.
 * Implementação iterativa pra evitar stack overflow em grafos grandes.
 */
function findStronglyConnectedComponents(
  nodes: GraphNode[],
  edges: GraphEdge[],
): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.fromNodeId)) adj.get(e.fromNodeId)!.push(e.toNodeId);
  }

  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  type Frame = { node: string; iter: Iterator<string>; lastChild?: string };
  const callStack: Frame[] = [];

  for (const start of nodes) {
    if (index.has(start.id)) continue;
    callStack.push({ node: start.id, iter: (adj.get(start.id) ?? [])[Symbol.iterator]() });
    index.set(start.id, counter);
    lowlink.set(start.id, counter);
    counter++;
    stack.push(start.id);
    onStack.add(start.id);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      // Atualiza lowlink pelo último filho processado, se houver
      if (frame.lastChild && onStack.has(frame.lastChild)) {
        lowlink.set(
          frame.node,
          Math.min(lowlink.get(frame.node)!, lowlink.get(frame.lastChild)!),
        );
      }

      const next = frame.iter.next();
      if (next.done) {
        // Pop frame e identifica SCC se for raiz
        if (lowlink.get(frame.node) === index.get(frame.node)) {
          const scc: string[] = [];
          let popped: string;
          do {
            popped = stack.pop()!;
            onStack.delete(popped);
            scc.push(popped);
          } while (popped !== frame.node);
          if (scc.length > 1 || edges.some((e) => e.fromNodeId === frame.node && e.toNodeId === frame.node)) {
            sccs.push(scc);
          }
        }
        callStack.pop();
        if (callStack.length > 0) callStack[callStack.length - 1].lastChild = frame.node;
        continue;
      }

      const child = next.value;
      frame.lastChild = child;
      if (!index.has(child)) {
        index.set(child, counter);
        lowlink.set(child, counter);
        counter++;
        stack.push(child);
        onStack.add(child);
        callStack.push({ node: child, iter: (adj.get(child) ?? [])[Symbol.iterator]() });
      } else if (onStack.has(child)) {
        lowlink.set(
          frame.node,
          Math.min(lowlink.get(frame.node)!, index.get(child)!),
        );
      }
    }
  }

  return sccs;
}

/**
 * Roda detecção de ciclos no grafo. Um ciclo é considerado SEGURO se contém
 * pelo menos um nó de controle (IF_CONDITION, SWITCH_CASE, LOOP_OVER, etc).
 * Caso contrário é INSEGURO — bloqueia salvar.
 */
export function detectCycles(
  nodes: GraphNode[],
  edges: GraphEdge[],
): CycleReport {
  const sccs = findStronglyConnectedComponents(nodes, edges);
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));

  const cycles: string[][] = [];
  const unsafeCycles: string[][] = [];
  const warnings: string[] = [];

  for (const scc of sccs) {
    cycles.push(scc);
    const hasControl = scc.some((id) => {
      const t = typeById.get(id);
      return t ? CONTROL_NODE_TYPES.has(t) : false;
    });
    if (!hasControl) {
      unsafeCycles.push(scc);
      warnings.push(
        `Loop infinito detectado entre os nós [${scc.join(", ")}]. Adicione um nó IF, SWITCH, LOOP ou WAIT no caminho com critério de parada.`,
      );
    }
  }

  return {
    safe: unsafeCycles.length === 0,
    cycles,
    unsafeCycles,
    warnings,
  };
}

/**
 * Cap absoluto de execuções por run. Mesmo workflows que passam pelo
 * cycle-detector estático respeitam este teto em runtime — defesa de fundo
 * contra bugs no detector ou nós de controle mal configurados.
 */
export const MAX_EXECUTIONS_PER_RUN = 100;
