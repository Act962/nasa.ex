/**
 * Aplica um BlueprintV2 + mapping (decisões do user) → cria Workflow (ou
 * anexa nodes a um workflow alvo no caso de seleção parcial).
 *
 * Aceita 2 modos:
 *  - kind="full-workflow": cria workflow novo no `targetTrackingId`
 *  - kind="node-selection": anexa os nodes ao `targetWorkflowId`
 */
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  importFullWorkflow,
  importNodeSelection,
} from "@/features/workflow-clipboard/lib/deserialize";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

const refMappingDecisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reuse"), targetId: z.string() }),
  z.object({ kind: z.literal("create") }),
  z.object({ kind: z.literal("skip") }),
]);

const blueprintSchema = z
  .object({
    formatVersion: z.literal(1),
    kind: z.enum(["full-workflow", "node-selection"]),
    workflow: z
      .object({
        name: z.string(),
        description: z.string().nullable().optional(),
        agentMode: z.boolean(),
        maxRunsPerHour: z.number().int().nullable().optional(),
      })
      .optional(),
    source: z.object({
      organizationName: z.string().optional(),
      trackingName: z.string().optional(),
      workflowName: z.string().optional(),
      exportedAt: z.string(),
      appVersion: z.string().optional(),
    }),
    nodes: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.string(), z.unknown()),
      }),
    ),
    edges: z.array(
      z.object({
        fromNodeId: z.string(),
        toNodeId: z.string(),
        fromOutput: z.string().optional(),
        toInput: z.string().optional(),
      }),
    ),
    refs: z.array(
      z.object({
        type: z.string(),
        slug: z.string(),
        label: z.string(),
        color: z.string().nullable().optional(),
        originalId: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  })
  .passthrough();

const inputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create-workflow"),
    blueprint: blueprintSchema,
    targetTrackingId: z.string(),
    mapping: z.record(z.string(), refMappingDecisionSchema),
    nameOverride: z.string().optional(),
    folderId: z.string().nullable().optional(),
    isActive: z.boolean().default(false),
  }),
  z.object({
    mode: z.literal("append-nodes"),
    blueprint: blueprintSchema,
    targetWorkflowId: z.string(),
    mapping: z.record(z.string(), refMappingDecisionSchema),
    offset: z
      .object({ x: z.number(), y: z.number() })
      .optional(),
  }),
]);

export const importWorkflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(inputSchema)
  .handler(async ({ input, context, errors }) => {
    if (input.mode === "create-workflow") {
      // Valida tracking destino
      const tracking = await prisma.tracking.findUnique({
        where: { id: input.targetTrackingId },
        select: { id: true, organizationId: true, name: true },
      });
      if (!tracking || tracking.organizationId !== context.org.id) {
        throw errors.FORBIDDEN({
          message: "tracking destino inválido ou de outra organização",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        return importFullWorkflow(tx, {
          organizationId: context.org.id,
          targetTrackingId: input.targetTrackingId,
          userId: context.user.id,
          blueprint: input.blueprint as any,
          mapping: input.mapping,
          isActive: input.isActive,
          nameOverride: input.nameOverride,
          folderId: input.folderId ?? null,
        });
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: "workflow.imported",
        actionLabel: `Importou workflow "${
          input.nameOverride ?? input.blueprint.workflow?.name ?? "(sem nome)"
        }" para ${tracking.name}`,
        resource: input.nameOverride ?? input.blueprint.workflow?.name,
        resourceId: result.workflowId,
        metadata: {
          source: input.blueprint.source,
          nodesCreated: result.nodesCreated,
          edgesCreated: result.edgesCreated,
          refsCreated: result.refsCreated.length,
          refsReused: result.refsReused.length,
          refsSkipped: result.refsSkipped.length,
        },
      });

      return { mode: input.mode, ...result };
    }

    // mode = append-nodes
    const target = await prisma.workflow.findUnique({
      where: { id: input.targetWorkflowId },
      select: {
        id: true,
        name: true,
        tracking: { select: { organizationId: true, name: true } },
      },
    });
    if (!target) {
      throw errors.NOT_FOUND({ message: "target_workflow_not_found" });
    }
    if (target.tracking?.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({
        message: "workflow destino não pertence à organização ativa",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      return importNodeSelection(tx, {
        organizationId: context.org.id,
        targetWorkflowId: input.targetWorkflowId,
        blueprint: input.blueprint as any,
        mapping: input.mapping,
        offset: input.offset,
      });
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      action: "workflow.nodes_pasted",
      actionLabel: `Colou ${result.nodesCreated} nó(s) em "${target.name}"`,
      resource: target.name,
      resourceId: target.id,
      metadata: {
        source: input.blueprint.source,
        nodesCreated: result.nodesCreated,
        edgesCreated: result.edgesCreated,
      },
    });

    return { mode: input.mode, ...result };
  });
