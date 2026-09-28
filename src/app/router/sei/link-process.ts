import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertLeadInOrganization } from "./_access";

export const linkSeiProcess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    leadId: z.string().min(1),
    protocolo: z.string().trim().min(3).max(80),
  }))
  .handler(async ({ input, context }) => {
    await assertLeadInOrganization(input.leadId, context.org.id);
    const link = await prisma.seiProcessLink.upsert({
      where: {
        leadId_protocoloProcedimento: {
          leadId: input.leadId,
          protocoloProcedimento: input.protocolo,
        },
      },
      create: {
        leadId: input.leadId,
        organizationId: context.org.id,
        protocoloProcedimento: input.protocolo,
      },
      update: {},
    });
    return { link };
  });
