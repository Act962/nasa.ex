import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";

export const updateName = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      name: z.string(),
    })
  )
  .output(
    z.object({
      id: z.string(),
      workflowName: z.string(),
      trackingId: z.string(),
    })
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: input.workflowId,
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow not found",
      });
    }

    const updatedWorkflow = await prisma.workflow.update({
      where: {
        id: input.workflowId,
      },
      data: {
        name: input.name,
      },
    });

    return {
      id: updatedWorkflow.id,
      workflowName: updatedWorkflow.name,
      trackingId: updatedWorkflow.trackingId,
    };
  });

export const updateNodes = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      nodes: z.array(
        z.object({
          id: z.string(),
          type: z.string().nullish(),
          position: z.object({ x: z.number(), y: z.number() }),
          data: z.record(z.string(), z.any()).optional(),
        })
      ),
      edges: z.array(
        z.object({
          source: z.string(),
          target: z.string(),
          sourceHandle: z.string().nullish(),
          targetHandle: z.string().nullish(),
        })
      ),
    })
  )
  .handler(async ({ input, errors }) => {
    const { id, nodes, edges } = input;

    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: {
        id,
      },
    });

    return await prisma.$transaction(async (tx) => {
      await tx.node.deleteMany({
        where: {
          workflowId: id,
        },
      });

      await tx.node.createMany({
        data: nodes.map((node) => ({
          id: node.id,
          workflowId: id,
          name: node.type || "unknown",
          type: node.type as NodeType,
          position: node.position,
          data: node.data || {},
        })),
      });

      await tx.connection.createMany({
        data: edges.map((edge) => ({
          workflowId: id,
          fromNodeId: edge.source,
          toNodeId: edge.target,
          fromOutput: edge.sourceHandle || "main",
          toInput: edge.targetHandle || "main",
        })),
      });

      // Update workflow's updatedAt timestamp
      await tx.workflow.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return workflow;
    });
  });
