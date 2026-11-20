import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { findWorkspaceWorkflowInOrg } from "@/features/workspace/server/lib/workspace-access";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteWorkspaceWorkflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const wf = await findWorkspaceWorkflowInOrg(input.id, context.org.id);
    if (!wf) throw errors.NOT_FOUND({ message: "Workflow não encontrado" });

    await prisma.workflow.delete({ where: { id: input.id } });
    return wf;
  });
