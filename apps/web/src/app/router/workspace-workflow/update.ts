import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateWorkspaceWorkflowName = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      name: z.string().min(1),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      workflowName: z.string(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const wf = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
    });
    if (!wf) throw errors.NOT_FOUND({ message: "Workflow not found" });
    if (!wf.workspaceId) {
      throw errors.BAD_REQUEST({ message: "Workflow não pertence a um workspace" });
    }

    const updated = await prisma.workflow.update({
      where: { id: input.workflowId },
      data: { name: input.name },
    });
    return {
      id: updated.id,
      workflowName: updated.name,
      workspaceId: updated.workspaceId!,
    };
  });

export const updateWorkspaceWorkflowNodes = base
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
        }),
      ),
      edges: z.array(
        z.object({
          source: z.string(),
          target: z.string(),
          sourceHandle: z.string().nullish(),
          targetHandle: z.string().nullish(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const { id, nodes, edges } = input;

    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: { id },
    });

    return prisma.$transaction(async (tx) => {
      await tx.node.deleteMany({ where: { workflowId: id } });

      await tx.node.createMany({
        data: nodes.map((n) => ({
          id: n.id,
          workflowId: id,
          name: n.type || "unknown",
          type: n.type as NodeType,
          position: n.position,
          data: n.data || {},
        })),
      });

      await tx.connection.createMany({
        data: edges.map((e) => ({
          workflowId: id,
          fromNodeId: e.source,
          toNodeId: e.target,
          fromOutput: e.sourceHandle || "main",
          toInput: e.targetHandle || "main",
        })),
      });

      await tx.workflow.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return workflow;
    });
  });
