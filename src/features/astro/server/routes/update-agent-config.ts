import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { agentConfigInputSchema } from "@/features/astro/schemas/agent-config";
import { userIsOrgAdmin } from "@/features/astro/server/tools/_shared/permissions";

/**
 * Upsert da config de um sub-agente. Apenas Owner/Admin da org pode chamar.
 */
export const updateAstroAgentConfig = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/astro/agent-configs/update",
    summary: "Upsert ASTRO agent config (admin only)",
  })
  .input(agentConfigInputSchema)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    if (!(await userIsOrgAdmin(context.user.id, organizationId))) {
      throw errors.FORBIDDEN({ message: "Apenas admin/owner pode configurar" });
    }

    const config = await prisma.aiAgentConfig.upsert({
      where: {
        organizationId_agentKey: {
          organizationId,
          agentKey: input.agentKey,
        },
      },
      update: {
        enabled: input.enabled,
        mode: input.mode,
        knowledgeIds: input.knowledgeIds,
      },
      create: {
        organizationId,
        agentKey: input.agentKey,
        enabled: input.enabled,
        mode: input.mode,
        knowledgeIds: input.knowledgeIds,
      },
    });

    return { config };
  });
