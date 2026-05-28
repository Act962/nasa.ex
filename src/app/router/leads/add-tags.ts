import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import { recordLeadHistory } from "./utils/history";
import {
  recordLeadEvent,
  type RecordLeadEventInput,
} from "@/features/leads/lib/history";
import { sendWorkflowExecution } from "@/inngest/utils";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { findLeadTaggedMatchingWorkflows } from "@/features/triggers/components/lead-tagged/find-matching-workflows";

export const addTagsToLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    path: "/leads/add-tags",
    method: "POST",
  })
  .input(
    z.object({
      leadId: z.string(),
      tagIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead) {
      throw errors.UNAUTHORIZED;
    }

    // Busca info das tags ANTES da operação pra capturar `name`/`color` no
    // metadata do journey event. Garante que a Jornada do lead continua
    // renderizando a tag mesmo depois que ela for arquivada/purgada.
    const tagsInfo = await prisma.tag.findMany({
      where: { id: { in: input.tagIds } },
      select: { id: true, name: true, color: true },
    });
    const tagInfoById = new Map(tagsInfo.map((t) => [t.id, t]));

    const pendingLeadEvents: RecordLeadEventInput[] = [];

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.leadTag.createMany({
        data: input.tagIds.map((tagId) => ({
          leadId: input.leadId,
          tagId,
        })),
        skipDuplicates: true,
      });

      await recordLeadHistory({
        leadId: input.leadId,
        userId: context.user.id,
        action: lead.currentAction,
        notes: "Tags adicionadas ao lead",
        tx,
      });

      // Evento granular pra Jornada — uma entrada por tag, com tagId +
      // tagName + tagColor no metadata. UI da timeline lê esses campos
      // direto pra renderizar mesmo se a tag for arquivada/purgada depois.
      for (const tagId of input.tagIds) {
        const info = tagInfoById.get(tagId);
        pendingLeadEvents.push({
          leadId: input.leadId,
          eventType: "TAG_ADDED",
          userId: context.user.id,
          metadata: {
            tagId,
            tagName: info?.name ?? null,
            tagColor: info?.color ?? null,
          },
        });
      }

      const workflows = await findLeadTaggedMatchingWorkflows({
        tx,
        trackingId: lead.trackingId,
        tagIds: input.tagIds,
      });

      return {
        count: created.count,
        workflows,
      };
    });

    if (pendingLeadEvents.length > 0) {
      await Promise.all(pendingLeadEvents.map((e) => recordLeadEvent(e)));
    }

    if (result.workflows.length > 0) {
      await Promise.all(
        result.workflows.map((workflow) =>
          sendWorkflowExecution({
            workflowId: workflow.id,
            initialData: {
              lead,
            },
          }),
        ),
      );
    }

    const tracking = await prisma.tracking.findUnique({
      where: { id: lead.trackingId },
      select: { organizationId: true, name: true },
    });
    if (tracking) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: input.tagIds } },
        select: { id: true, name: true },
      });
      await logActivity({
        organizationId: tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        subAppSlug: "tracking-pipeline",
        featureKey: "lead.tag.added",
        action: "lead.tag.added",
        actionLabel: `Adicionou ${result.count} tag(s) ao lead "${lead.name}"`,
        resource: lead.name,
        resourceId: lead.id,
        metadata: {
          trackingName: tracking.name,
          tagIds: input.tagIds,
          tagNames: tags.map((t) => t.name),
          count: result.count,
        },
      });

      // Alert engine — 1 publish por tag adicionada.
      await Promise.all(
        input.tagIds.map((tagId) =>
          eventBus.publish("lead.tag_added", {
            leadId: lead.id,
            tagId,
            orgId: tracking.organizationId,
            responsibleId: lead.responsibleId ?? null,
          }),
        ),
      );
    }

    return {
      count: result.count,
    };
  });
