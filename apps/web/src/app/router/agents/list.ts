import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista agentes da org com contagens básicas.
 * Filtro opcional por trackingId (null = org-wide; passa string pra
 * filtrar agents daquele tracking + org-wide).
 */
export const listAgents = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/agents",
    summary: "Lista agentes IA da org",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { org } = context;
    const agents = await prisma.agent.findMany({
      where: {
        organizationId: org.id,
        ...(input.trackingId
          ? { OR: [{ trackingId: input.trackingId }, { trackingId: null }] }
          : {}),
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        mode: true,
        isActive: true,
        trackingId: true,
        followUpSchedule: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sessions: true } },
      },
    });

    // Conta sessões ativas separadamente (status ACTIVE/WAITING)
    const activeCounts = await prisma.leadAgentSession.groupBy({
      by: ["agentId"],
      where: {
        agentId: { in: agents.map((a) => a.id) },
        status: { in: ["ACTIVE", "WAITING"] },
      },
      _count: { _all: true },
    });
    const activeByAgent = new Map(
      activeCounts.map((c) => [c.agentId, c._count._all]),
    );

    return {
      agents: agents.map((a) => ({
        ...a,
        sessionsTotal: a._count.sessions,
        sessionsActive: activeByAgent.get(a.id) ?? 0,
      })),
    };
  });
