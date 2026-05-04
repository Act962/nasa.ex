import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import { recordLeadHistory } from "./utils/history";
import { sendWorkflowExecution } from "@/inngest/utils";
import { logActivity } from "@/lib/activity-logger";

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

      const workflows = await tx.workflow.findMany({
        where: {
          trackingId: lead.trackingId,
          nodes: {
            some: {
              type: "LEAD_TAGGED",
              data: {
                path: ["action", "tagIds"],
                array_contains: input.tagIds,
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

      return {
        count: created.count,
        workflows,
      };
    });

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
    }

    return {
      count: result.count,
    };
  });
