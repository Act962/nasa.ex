/**
 * Procedure `workflow.stepNode` — usado pelo "Modo Step-by-Step" do
 * editor. Valida UM nó isoladamente (sem executar) e retorna:
 *  - status: ok | warning | error
 *  - errors[] / warnings[] — pra mostrar no popover
 *  - nextNodeIds — nós alcançáveis a partir desse (já filtrado pela
 *    branch escolhida se for AI_DECISION/IF/SWITCH/CHECK_PAYMENT)
 *  - availableOutputs — pra UI mostrar quais branches existem (caso o
 *    nó tenha decisão a fazer)
 *
 * Não chama LLM, não dispara uazapi, não persiste nada — pura função.
 * Reusa `validateNode` (campos) + `preflightWorkflow` (runtime checks).
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { validateNode } from "@/features/workflows/lib/validate-node";
import { preflightWorkflow } from "@/features/workflows/lib/preflight-workflow";
import z from "zod";

const mockLeadSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    statusId: z.string().optional(),
    trackingId: z.string().optional(),
    responsibleId: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .default({});

export const stepNodeProc = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      nodeId: z.string(),
      /** Branch escolhido manualmente — só pra AI_DECISION/IF/SWITCH/CHECK_PAYMENT */
      branchChoice: z.string().optional(),
      /** Mock context do lead (pra validar placeholders). */
      mockLead: mockLeadSchema,
    }),
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: {
        nodes: { select: { id: true, type: true, data: true, name: true } },
        connections: {
          select: { id: true, fromNodeId: true, toNodeId: true, fromOutput: true },
        },
      },
    });
    if (!workflow) throw errors.NOT_FOUND({ message: "Workflow não encontrado" });

    const node = workflow.nodes.find((n) => n.id === input.nodeId);
    if (!node) throw errors.NOT_FOUND({ message: "Nó não encontrado" });

    const errorsList: string[] = [];
    const warningsList: string[] = [];

    // ── 1. validateNode (campos do nó) ────────────────────────────
    const nodeValidation = validateNode(node.type, node.data as Record<string, unknown>);
    if (!nodeValidation.valid && !nodeValidation.skip) {
      errorsList.push(...nodeValidation.errors);
    }

    // ── 2. preflightWorkflow filtrado pra esse nó específico ──────
    const preflight = await preflightWorkflow({ workflowId: input.workflowId });
    for (const c of preflight.checks) {
      if (c.nodeId !== input.nodeId && c.nodeId !== null) continue;
      if (c.severity === "error") errorsList.push(`[${c.code}] ${c.message}`);
      else if (c.severity === "warning") warningsList.push(`[${c.code}] ${c.message}`);
    }

    // ── 3. Placeholders {{lead.X}} no SEND_MESSAGE ────────────────
    if (node.type === "SEND_MESSAGE") {
      const action = unwrapAction(node.data as Record<string, unknown> | null);
      const payload = (action.payload as Record<string, unknown> | undefined) ?? {};
      const text = String(
        payload.message ?? payload.text ?? payload.bodyText ?? "",
      );
      const placeholders = [...text.matchAll(/\{\{\s*lead\.([a-zA-Z0-9_]+)\s*\}\}/g)];
      for (const m of placeholders) {
        const path = m[1];
        const val = (input.mockLead as Record<string, unknown>)[path];
        if (val === undefined || val === null || val === "") {
          warningsList.push(
            `Placeholder {{lead.${path}}} vai resolver vazio (mock não preenchido)`,
          );
        }
      }
    }

    // ── 4. Lead ativo pra SEND_*? ─────────────────────────────────
    const messagingTypes = ["SEND_MESSAGE", "SEND_MEDIA", "SEND_VOICE"];
    if (messagingTypes.includes(node.type)) {
      if (input.mockLead.isActive === false) {
        warningsList.push(
          "Mock lead está com isActive=false → executor vai abortar com 'Lead is not active' em runtime",
        );
      }
      if (!input.mockLead.phone) {
        warningsList.push(
          "Mock lead sem phone → executor vai abortar em runtime",
        );
      }
    }

    // ── 5. Branches/outputs disponíveis ──────────────────────────
    const outConns = workflow.connections.filter((c) => c.fromNodeId === input.nodeId);
    const availableOutputs = [...new Set(outConns.map((c) => c.fromOutput ?? "main"))];

    // ── 6. Resolução de nextNodeIds baseado em branchChoice ──────
    let chosenOutput = "main";
    if (
      ["AI_DECISION", "IF_CONDITION", "SWITCH_CASE", "CHECK_PAYMENT", "LOOP_OVER"].includes(node.type)
    ) {
      if (input.branchChoice) {
        chosenOutput = input.branchChoice;
      } else if (availableOutputs.length > 0) {
        chosenOutput = availableOutputs[0]; // default — UI deve forçar escolha
      }
    }

    const nextNodeIds = outConns
      .filter((c) => (c.fromOutput ?? "main") === chosenOutput)
      .map((c) => c.toNodeId);

    // ── 7. Status final ──────────────────────────────────────────
    const status: "ok" | "warning" | "error" =
      errorsList.length > 0 ? "error" : warningsList.length > 0 ? "warning" : "ok";

    return {
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name ?? node.type,
      status,
      errors: errorsList,
      warnings: warningsList,
      availableOutputs,
      chosenOutput,
      nextNodeIds,
      /** Edges saindo desse nó — UI usa pra colorir certas. */
      outgoingEdges: outConns.map((c) => ({
        edgeId: c.id,
        toNodeId: c.toNodeId,
        fromOutput: c.fromOutput ?? "main",
        isChosen: (c.fromOutput ?? "main") === chosenOutput,
      })),
    };
  });

function unwrapAction(
  data: Record<string, unknown> | null,
): Record<string, unknown> {
  const d = data ?? {};
  if (d.action && typeof d.action === "object" && !Array.isArray(d.action)) {
    return d.action as Record<string, unknown>;
  }
  return d;
}
