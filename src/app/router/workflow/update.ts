import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { AUTOMATION_DENIAL, checkWorkflowAccess } from "@/features/workflows/server/workflow-access";
import prisma from "@/lib/prisma";
import { saveWorkflowGraph, WorkflowSaveError } from "@/features/workflows/server/save-workflow-graph";
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
  .handler(async ({ input, context, errors }) => {
    // Ser da empresa não basta: vale a permissão de Automações do papel da pessoa (spec 0092).
    const access = await checkWorkflowAccess(input.workflowId, context.user.id, "canEdit");
    if (access === "not-found") throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    if (access === "forbidden") throw errors.FORBIDDEN({ message: AUTOMATION_DENIAL.canEdit });

    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: {
        tracking: { select: { name: true, organizationId: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow not found",
      });
    }

    const oldName = workflow.name;
    const updatedWorkflow = await prisma.workflow.update({
      where: { id: input.workflowId },
      data: { name: input.name },
    });

    // Fluxo do FlowAstro é da empresa, sem funil (spec 0139, D-11).
    if (!updatedWorkflow.trackingId && !updatedWorkflow.organizationId) {
      throw errors.BAD_REQUEST({
        message: "Workflow não pertence a um tracking",
      });
    }

    if (workflow.tracking?.organizationId && oldName !== input.name) {
      await logActivity({
        organizationId: workflow.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: "workflow.renamed",
        actionLabel: `Renomeou automação "${oldName}" → "${input.name}"`,
        resource: input.name,
        resourceId: updatedWorkflow.id,
        metadata: {
          trackingName: workflow.tracking.name,
          oldName,
          newName: input.name,
        },
      });
    }

    return {
      id: updatedWorkflow.id,
      workflowName: updatedWorkflow.name,
      trackingId: updatedWorkflow.trackingId ?? "",
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
  .handler(async ({ input, context, errors }) => {
    const { id, nodes, edges } = input;

    // Ser da empresa não basta: vale a permissão de Automações do papel da pessoa (spec 0092).
    const access = await checkWorkflowAccess(id, context.user.id, "canEdit");
    if (access === "not-found") throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    if (access === "forbidden") throw errors.FORBIDDEN({ message: AUTOMATION_DENIAL.canEdit });

    try {
      const saved = await saveWorkflowGraph({
        workflowId: id,
        nodes,
        edges,
        actor: { userId: context.user.id, userName: context.user.name, userEmail: context.user.email, userImage: context.user.image },
      });
      return { ...saved.workflow, entryConflict: saved.entryConflict };
    } catch (error) {
      if (error instanceof WorkflowSaveError) throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }
  });
