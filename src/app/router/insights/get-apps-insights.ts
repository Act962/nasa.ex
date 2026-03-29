import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getAppsInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      organizationIds: z.array(z.string()).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      trackingId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const orgIds = input.organizationIds?.length ? input.organizationIds : [orgId];

    const dateFilter =
      input.startDate && input.endDate
        ? {
            gte: new Date(input.startDate),
            lte: new Date(input.endDate),
          }
        : undefined;

    // ── Forge: Proposals ─────────────────────────────────────────────────────
    const [proposals, contracts] = await Promise.all([
      prisma.forgeProposal.findMany({
        where: {
          organizationId: { in: orgIds },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: {
          products: { select: { unitValue: true, quantity: true, discount: true } },
        },
      }),
      prisma.forgeContract.findMany({
        where: {
          organizationId: { in: orgIds },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, status: true, value: true, createdAt: true },
      }),
    ]);

    const calcProposalValue = (p: typeof proposals[0]) =>
      p.products.reduce((sum: number, prod) => {
        const base = Number(prod.unitValue) * Number(prod.quantity ?? 1);
        const disc = Number(prod.discount ?? 0);
        return sum + base - disc;
      }, 0);

    const forgeData = {
      totalProposals: proposals.length,
      rascunho:    proposals.filter((p) => p.status === "RASCUNHO").length,
      enviadas:    proposals.filter((p) => p.status === "ENVIADA").length,
      visualizadas: proposals.filter((p) => p.status === "VISUALIZADA").length,
      pagas:       proposals.filter((p) => p.status === "PAGA").length,
      expiradas:   proposals.filter((p) => p.status === "EXPIRADA").length,
      canceladas:  proposals.filter((p) => p.status === "CANCELADA").length,
      revenueTotal: proposals
        .filter((p) => p.status === "PAGA")
        .reduce((sum, p) => sum + calcProposalValue(p), 0),
      revenuePipeline: proposals
        .filter((p) => ["ENVIADA", "VISUALIZADA"].includes(p.status))
        .reduce((sum, p) => sum + calcProposalValue(p), 0),
      totalContracts: contracts.length,
      contractsAtivo: contracts.filter((c) => c.status === "ATIVO").length,
      contractsAssinado: contracts.filter((c) => c.status === "PENDENTE_ASSINATURA").length,
    };

    // ── Spacetime: Appointments ──────────────────────────────────────────────
    const appointments = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: { in: orgIds } },
        ...(dateFilter ? { startsAt: dateFilter } : {}),
        ...(input.trackingId ? { trackingId: input.trackingId } : {}),
      },
      select: { id: true, status: true, startsAt: true, leadId: true },
    });

    const spacetimeData = {
      total:     appointments.length,
      pending:   appointments.filter((a) => a.status === "PENDING").length,
      confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
      done:      appointments.filter((a) => a.status === "DONE").length,
      cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      noShow:    appointments.filter((a) => a.status === "NO_SHOW").length,
      withLead:  appointments.filter((a) => a.leadId).length,
      conversionRate:
        appointments.length > 0
          ? (appointments.filter((a) => a.status === "DONE").length / appointments.length) * 100
          : 0,
    };

    // ── NASA Post ────────────────────────────────────────────────────────────
    const posts = await prisma.nasaPost.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { id: true, status: true, targetNetworks: true, starsSpent: true, createdAt: true },
    });

    const nasaPostData = {
      total:      posts.length,
      draft:      posts.filter((p) => p.status === "DRAFT").length,
      published:  posts.filter((p) => p.status === "PUBLISHED").length,
      scheduled:  posts.filter((p) => p.status === "SCHEDULED").length,
      approved:   posts.filter((p) => p.status === "APPROVED").length,
      starsSpent: posts.reduce((s, p) => s + p.starsSpent, 0),
      byNetwork:  posts.reduce<Record<string, number>>((acc, p) => {
        p.targetNetworks.forEach((n) => { acc[n] = (acc[n] ?? 0) + 1; });
        return acc;
      }, {}),
    };

    // ── Chat: Conversations & Messages ───────────────────────────────────────
    const [conversations, totalMessages] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          tracking: { organizationId: { in: orgIds } },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(input.trackingId ? { trackingId: input.trackingId } : {}),
        },
        select: { id: true, isActive: true },
      }),
      prisma.message.count({
        where: {
          conversation: {
            tracking: { organizationId: { in: orgIds } },
            ...(input.trackingId ? { trackingId: input.trackingId } : {}),
          },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
    ]);

    // Active conversations as proxy for "attended"
    const attendedCount = conversations.filter((c) => c.isActive).length;

    const chatData = {
      totalConversations: conversations.length,
      totalMessages,
      attendedConversations: attendedCount,
      unattendedConversations: conversations.length - attendedCount,
      attendanceRate:
        conversations.length > 0
          ? (attendedCount / conversations.length) * 100
          : 0,
    };

    return {
      forge:     forgeData,
      spacetime: spacetimeData,
      nasaPost:  nasaPostData,
      chat:      chatData,
      period:    { startDate: input.startDate, endDate: input.endDate },
    };
  });
