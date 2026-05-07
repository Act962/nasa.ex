import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { AGENTS } from "@/features/astro/server/agents/registry";
import { AiAgentMode } from "@/generated/prisma/enums";

/**
 * Devolve a configuração de cada sub-agente conhecido para a org ativa.
 * Sempre retorna 1 entry por agente do registry — campos default quando não há
 * row no banco (lazy-create na primeira escrita).
 */
export const listAstroAgentConfigs = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/astro/agent-configs/list",
    summary: "List ASTRO agent configs for active org",
  })
  .handler(async ({ context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const rows = await prisma.aiAgentConfig.findMany({
      where: { organizationId },
    });
    const byKey = new Map(rows.map((r) => [r.agentKey, r]));

    return {
      configs: AGENTS.map((agent) => {
        const row = byKey.get(agent.key);
        return {
          agentKey: agent.key,
          displayName: agent.displayName,
          description: agent.shortDescription,
          enabled: row?.enabled ?? true,
          mode: row?.mode ?? AiAgentMode.MANUAL,
          knowledgeIds: row?.knowledgeIds ?? [],
        };
      }),
    };
  });
