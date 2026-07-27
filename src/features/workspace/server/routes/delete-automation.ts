import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findAutomationInOrg } from "../lib/workspace-access";

export const deleteAutomation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ automationId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const existing = await findAutomationInOrg(input.automationId, context.org.id);
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Automação não encontrada" });
    }

    await prisma.workspaceAutomation.delete({ where: { id: input.automationId } });
    return { success: true };
  });
