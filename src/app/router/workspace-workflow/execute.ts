import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { sendWorkspaceWorkflowEvent } from "@/inngest/utils";
import { findWorkspaceWorkflowInOrg } from "@/features/workspace/server/lib/workspace-access";
import { z } from "zod";

export const executeWorkspaceWorkflowRoute = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      actionId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const wf = await findWorkspaceWorkflowInOrg(input.id, context.org.id);
    if (!wf) throw errors.NOT_FOUND({ message: "Workflow não encontrado" });
    if (!wf.workspaceId) {
      throw errors.BAD_REQUEST({
        message: "Workflow não pertence a um workspace",
      });
    }
    if (!wf.isActive) {
      throw errors.BAD_REQUEST({
        message: "Automação está desativada",
      });
    }

    await sendWorkspaceWorkflowEvent({
      trigger: "WS_MANUAL_TRIGGER",
      workspaceId: wf.workspaceId,
      actionId: input.actionId,
      workflowId: wf.id,
    });

    return wf;
  });
