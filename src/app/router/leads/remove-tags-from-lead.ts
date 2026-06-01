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
import { logActivity } from "@/features/admin/lib/activity-logger";

export const removeTagsFromLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    path: "/leads/remove-tags",
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

    // Captura name/color das tags ANTES da remoção pra metadata da Jornada
    // (mesma estratégia do add-tags). Mesmo que a tag seja arquivada/purgada
    // depois, o evento preserva o snapshot visual.
    const tagsInfo = await prisma.tag.findMany({
      where: { id: { in: input.tagIds } },
      select: { id: true, name: true, color: true },
    });
    const tagInfoById = new Map(tagsInfo.map((t) => [t.id, t]));

    const pendingLeadEvents: RecordLeadEventInput[] = [];

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.leadTag.deleteMany({
        where: {
          leadId: input.leadId,
          tagId: {
            in: input.tagIds,
          },
        },
      });

      await recordLeadHistory({
        leadId: input.leadId,
        userId: context.user.id,
        action: lead.currentAction,
        notes: "Tags removidas do lead",
        tx,
      });

      // Evento granular por tag (mesmo padrão do add-tags) — coletado pra
      // disparar Pusher FORA da tx. Enriquece com tagName/tagColor pra
      // preservar visual mesmo se tag for arquivada/purgada depois.
      for (const tagId of input.tagIds) {
        const info = tagInfoById.get(tagId);
        pendingLeadEvents.push({
          leadId: input.leadId,
          eventType: "TAG_REMOVED",
          userId: context.user.id,
          metadata: {
            tagId,
            tagName: info?.name ?? null,
            tagColor: info?.color ?? null,
          },
        });
      }

      return deleted;
    });

    if (pendingLeadEvents.length > 0) {
      await Promise.all(pendingLeadEvents.map((e) => recordLeadEvent(e)));
    }

    const tracking = await prisma.tracking.findUnique({
      where: { id: lead.trackingId },
      select: { organizationId: true, name: true },
    });
    if (tracking) {
      await logActivity({
        organizationId: tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        subAppSlug: "tracking-pipeline",
        featureKey: "lead.tag.removed",
        action: "lead.tag.removed",
        actionLabel: `Removeu ${result.count} tag(s) do lead "${lead.name}"`,
        resource: lead.name,
        resourceId: lead.id,
        metadata: {
          trackingName: tracking.name,
          tagIds: input.tagIds,
          count: result.count,
        },
      });
    }

    return {
      count: result.count,
    };
  });
