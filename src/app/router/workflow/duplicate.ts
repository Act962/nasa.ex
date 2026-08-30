import { createId } from "@paralleldrive/cuid2";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Duplica um Workflow (nodes + connections) para o MESMO tracking ou outro
 * da mesma organização. A cópia:
 *  - nasce `isActive: false` (usuário precisa revisar e ativar);
 *  - preserva `agentMode`, `description`, `maxRunsPerHour`;
 *  - recebe `userId` do duplicador (não do autor original);
 *  - descarta `folderId` (fica em "Sem pasta" — usuário move depois via UI);
 *  - regenera IDs dos nodes e reconstrói as connections com o remap.
 *
 * Não copiamos `WorkflowRun`, `WorkflowNodeRun` nem `LeadDailyTriggerClaim`
 * (são histórico/estado de execução do workflow original).
 */
export const duplicateWorkflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      targetTrackingId: z.string(),
      name: z.string().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const source = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: {
        nodes: true,
        connections: true,
        tracking: { select: { organizationId: true, name: true } },
        workspace: { select: { organizationId: true } },
      },
    });

    if (!source) {
      throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    }

    const sourceOrgId =
      source.tracking?.organizationId ?? source.workspace?.organizationId;
    if (!sourceOrgId || sourceOrgId !== context.org.id) {
      throw errors.FORBIDDEN({
        message: "Workflow pertence a outra organização",
      });
    }

    const targetTracking = await prisma.tracking.findUnique({
      where: { id: input.targetTrackingId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!targetTracking) {
      throw errors.BAD_REQUEST({
        message: "Tracking de destino não encontrado",
      });
    }

    if (targetTracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({
        message: "Tracking de destino pertence a outra organização",
      });
    }

    const newName = (input.name?.trim() || `${source.name} (cópia)`).slice(
      0,
      200,
    );

    const duplicated = await prisma.$transaction(async (tx) => {
      const created = await tx.workflow.create({
        data: {
          name: newName,
          description: source.description,
          trackingId: targetTracking.id,
          workspaceId: null,
          folderId: null,
          userId: context.user.id,
          isActive: false,
          agentMode: source.agentMode,
          maxRunsPerHour: source.maxRunsPerHour,
        },
      });

      // Remapeia node IDs: novo cuid por node, preservando o resto (type,
      // name, position, data). `data` é Json arbitrário — copia como veio.
      const nodeIdMap = new Map<string, string>();
      if (source.nodes.length > 0) {
        const nodesToCreate = source.nodes.map((sourceNode) => {
          const newId = createId();
          nodeIdMap.set(sourceNode.id, newId);
          return {
            id: newId,
            workflowId: created.id,
            name: sourceNode.name,
            type: sourceNode.type,
            position: sourceNode.position ?? { x: 0, y: 0 },
            data: sourceNode.data ?? {},
          };
        });
        await tx.node.createMany({ data: nodesToCreate });
      }

      // Reconstrói as connections usando o remap. Ignora edges cujo from/to
      // não achamos (defesa: nunca deve acontecer, mas evita FK error).
      const connectionsToCreate = source.connections
        .map((connection) => {
          const fromNodeId = nodeIdMap.get(connection.fromNodeId);
          const toNodeId = nodeIdMap.get(connection.toNodeId);
          if (!fromNodeId || !toNodeId) return null;
          return {
            workflowId: created.id,
            fromNodeId,
            toNodeId,
            fromOutput: connection.fromOutput,
            toInput: connection.toInput,
          };
        })
        .filter((connection): connection is NonNullable<typeof connection> =>
          Boolean(connection),
        );

      if (connectionsToCreate.length > 0) {
        await tx.connection.createMany({ data: connectionsToCreate });
      }

      return {
        workflow: created,
        nodesCreated: source.nodes.length,
        edgesCreated: connectionsToCreate.length,
      };
    });

    await logActivity({
      organizationId: targetTracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as { image?: string | null }).image ?? null,
      appSlug: "tracking",
      action: "workflow.duplicated",
      actionLabel: `Duplicou a automação "${source.name}" como "${duplicated.workflow.name}" no tracking "${targetTracking.name}"`,
      resource: duplicated.workflow.name,
      resourceId: duplicated.workflow.id,
      metadata: {
        sourceWorkflowId: source.id,
        sourceTrackingName: source.tracking?.name ?? null,
        targetTrackingName: targetTracking.name,
        nodesCreated: duplicated.nodesCreated,
        edgesCreated: duplicated.edgesCreated,
      },
    }).catch((err) =>
      console.warn("[workflow/duplicate] logActivity failed", err),
    );

    return {
      id: duplicated.workflow.id,
      name: duplicated.workflow.name,
      trackingId: duplicated.workflow.trackingId,
      sourceTrackingId: source.trackingId,
      nodesCreated: duplicated.nodesCreated,
      edgesCreated: duplicated.edgesCreated,
      editorUrl: `/tracking/${targetTracking.id}/workflows/${duplicated.workflow.id}`,
    };
  });
