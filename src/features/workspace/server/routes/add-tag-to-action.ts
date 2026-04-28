import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { hasTaggedWorkflow, sendWorkspaceWorkflowEvent } from "@/inngest/utils";
import { z } from "zod";

export const addTagToAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), tagId: z.string() }))
  .handler(async ({ input }) => {
    await prisma.actionTag.upsert({
      where: { actionId_tagId: { actionId: input.actionId, tagId: input.tagId } },
      create: { actionId: input.actionId, tagId: input.tagId },
      update: {},
    });

    try {
      const action = await prisma.action.findUnique({
        where: { id: input.actionId },
        select: { workspaceId: true },
      });
      if (action) {
        const hasListener = await hasTaggedWorkflow(
          action.workspaceId,
          input.tagId,
        );
        if (hasListener) {
          await sendWorkspaceWorkflowEvent({
            trigger: "WS_ACTION_TAGGED",
            workspaceId: action.workspaceId,
            actionId: input.actionId,
            tagId: input.tagId,
          });
        }
      }
    } catch (err) {
      console.error("[workspace-workflow] failed to emit action.tagged", err);
    }

    return { success: true };
  });
