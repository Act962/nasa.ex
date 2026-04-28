import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { Edge, Node } from "@xyflow/react";
import { z } from "zod";

export const getWorkspaceWorkflow = base
  .use(requiredAuthMiddleware)
  .input(z.object({ workflowId: z.string() }))
  .output(
    z.object({
      workflow: z.custom<Workflow>(),
      nodes: z.array(z.custom<Node>()),
      edges: z.array(z.custom<Edge>()),
    }),
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: { nodes: true, connections: true },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    }

    const nodes: Node[] = workflow.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position as { x: number; y: number },
      data: (n.data as Record<string, unknown>) || {},
    }));

    const edges: Edge[] = workflow.connections.map((c) => ({
      id: c.id,
      source: c.fromNodeId,
      target: c.toNodeId,
      sourceHandle: c.fromOutput,
      targetHandle: c.toInput,
    }));

    return { workflow, nodes, edges };
  });
