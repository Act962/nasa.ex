import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType, Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { Edge, Node } from "@xyflow/react";
import { z } from "zod";

export const getWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
    })
  )
  .output(
    z.object({
      workflow: z.custom<Workflow>(),
      nodes: z.array(z.custom<Node>()),
      edges: z.array(z.custom<Edge>()),
    })
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: input.workflowId,
      },
      include: { nodes: true, connections: true },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow não encontrado",
      });
    }

    const nodes: Node[] = workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position as { x: number; y: number },
      data: (node.data as Record<string, unknown>) || {},
    }));

    const edges: Edge[] = workflow.connections.map((connection) => ({
      id: connection.id,
      source: connection.fromNodeId,
      target: connection.toNodeId,
      sourceHandle: connection.fromOutput,
      targetHandle: connection.toInput,
    }));

    return {
      workflow,
      nodes,
      edges,
    };
  });
