import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { createWorkspaceColumnRecord } from "../lib/workspace-commands";
import { z } from "zod";
import { findWorkspaceInOrg } from "../lib/workspace-access";

export const createColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      name: z.string(),
      color: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workspace = await findWorkspaceInOrg(input.workspaceId, context.org.id);
    if (!workspace) {
      throw errors.NOT_FOUND({ message: "Workspace não encontrado" });
    }

    const column = await createWorkspaceColumnRecord({ workspaceId: input.workspaceId, name: input.name, color: input.color });

    return { column };
  });
