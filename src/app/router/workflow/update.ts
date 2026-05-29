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
      name: z
        .string()
        .min(1, "Nome do workflow deve ter pelo menos 1 caractere"),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      workflowName: z.string(),
      trackingId: z.string(),
    }),
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

    if (!updatedWorkflow.trackingId) {
      throw errors.BAD_REQUEST({
        message: "Workflow não pertence a um tracking",
      });
    }

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
  .handler(async ({ input, errors }) => {
    const { id, nodes, edges } = input;

    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        trackingId: true,
        workspaceId: true,
        userId: true,
        folderId: true,
        isActive: true,
        agentMode: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Modo Agente IA: roda cycle-detector ANTES de persistir.
    // Workflows clássicos não têm branches/loops, então o detector é skip.
    if (workflow.agentMode) {
      const { detectCycles } = await import(
        "@/features/workflows/lib/cycle-detector"
      );
      const report = detectCycles(
        nodes.map((n) => ({ id: n.id, type: n.type || "" })),
        edges.map((e) => ({ fromNodeId: e.source, toNodeId: e.target })),
      );
      if (!report.safe) {
        throw errors.BAD_REQUEST({
          message: `Loop infinito detectado:\n${report.warnings.join("\n")}`,
        });
      }
    }

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
          // Normaliza handles visuais default → semântica "main" no DB.
          // Handles nomeados (true/false/loop/done/case_X, branches IA) são
          // preservados pra que o engine `run-workflow.ts` resolva
          // `adjBy.get(nodeId).get(fromOutput)` corretamente.
          fromOutput:
            !edge.sourceHandle || edge.sourceHandle === "source-1"
              ? "main"
              : edge.sourceHandle,
          toInput:
            !edge.targetHandle || edge.targetHandle === "target-1"
              ? "main"
              : edge.targetHandle,
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
