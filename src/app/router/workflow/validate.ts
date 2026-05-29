/**
 * Procedure `workflow.validate` — combina:
 *  - Validação por nó (`validateWorkflow` → erros de campo do dialog)
 *  - Validação de grafo (`validateWorkflowGraph` → órfãos, branches, refs)
 *
 * Não roda preflight (UAZAPI, AI key) — esses ficam só no Rocket-run pra
 * não bater no banco a cada keystroke do editor.
 *
 * O hook `useWorkflowValidation` chama isso com debounce; o painel lateral
 * mostra todos os issues; os nodes leem o `nodeErrors` map pra pintar borda.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { validateWorkflow } from "@/features/workflows/lib/validate-node";
import {
  validateWorkflowGraph,
  type GraphIssue,
} from "@/features/workflows/lib/validate-workflow-graph";
import { z } from "zod";

export const validateWorkflowProc = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      select: {
        id: true,
        nodes: { select: { id: true, type: true, data: true, name: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    }

    const perNode = validateWorkflow(
      workflow.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data as unknown,
        name: n.name,
      })),
    );

    const graph = await validateWorkflowGraph(input.workflowId);

    // Indexa issues por nodeId pra o canvas saber pintar borda vermelha
    const issuesByNode: Record<string, GraphIssue[]> = {};
    for (const issue of graph.issues) {
      if (!issue.nodeId) continue;
      if (!issuesByNode[issue.nodeId]) issuesByNode[issue.nodeId] = [];
      issuesByNode[issue.nodeId].push(issue);
    }
    for (const bn of perNode.blockingNodes) {
      if (!issuesByNode[bn.id]) issuesByNode[bn.id] = [];
      for (const errMsg of bn.errors) {
        issuesByNode[bn.id].push({
          nodeId: bn.id,
          severity: "error",
          code: "ORPHAN_NODE", // reusa enum — UI mostra a message original
          message: errMsg,
        });
      }
    }

    return {
      valid: perNode.valid && graph.valid,
      // erros legados de campo (lista por nó)
      blockingNodes: perNode.blockingNodes,
      // issues estruturais do grafo (achatado pro painel)
      graphIssues: graph.issues,
      // por-nó pra o canvas
      issuesByNode,
    };
  });
