import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertLeadInOrganization } from "./_access";

export const listLeadSeiProcesses = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ leadId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await assertLeadInOrganization(input.leadId, context.org.id);
    const processes = await prisma.seiProcessLink.findMany({
      where: { leadId: input.leadId, organizationId: context.org.id },
      orderBy: { updatedAt: "desc" },
    });
    return { processes };
  });
