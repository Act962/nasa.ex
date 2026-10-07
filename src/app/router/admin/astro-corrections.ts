import { z } from "zod";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { CORRECTION_STATUSES } from "@/features/astro-corrections/lib/parse-correction";

// Painel de correções do ASTRO (spec 0073): o que os usuários apontaram como
// erro, para a equipe ajustar o produto. Só admin do sistema.

const turnSchema = z.object({ user: z.string(), astro: z.string(), at: z.string() });

function toTranscript(raw: unknown): z.infer<typeof turnSchema>[] {
  const parsed = z.array(turnSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export const listAstroCorrections = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List ASTRO corrections", tags: ["Admin"] })
  .input(
    z.object({
      status: z.enum(CORRECTION_STATUSES).default("OPEN"),
      route: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }),
  )
  .output(
    z.object({
      corrections: z.array(
        z.object({
          id: z.string(),
          organizationName: z.string(),
          userName: z.string(),
          channel: z.string(),
          userMessage: z.string(),
          astroReply: z.string(),
          route: z.string().nullable(),
          expected: z.string().nullable(),
          status: z.string(),
          resolutionNote: z.string().nullable(),
          transcript: z.array(turnSchema),
          createdAt: z.string(),
        }),
      ),
      total: z.number(),
      openByRoute: z.array(z.object({ route: z.string(), count: z.number() })),
    }),
  )
  .handler(async ({ input }) => {
    const routeFilter = input.route === "sem rota" ? { route: null } : input.route ? { route: input.route } : {};
    const where = { status: input.status, ...routeFilter };
    const [corrections, total, openGroups] = await Promise.all([
      prisma.astroCorrection.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.astroCorrection.count({ where }),
      prisma.astroCorrection.groupBy({ by: ["route"], where: { status: "OPEN" }, _count: { _all: true } }),
    ]);

    const [organizations, users] = await Promise.all([
      prisma.organization.findMany({
        where: { id: { in: [...new Set(corrections.map((correction) => correction.organizationId))] } },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { id: { in: [...new Set(corrections.map((correction) => correction.userId))] } },
        select: { id: true, name: true },
      }),
    ]);
    const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.name]));
    const userNames = new Map(users.map((user) => [user.id, user.name]));

    return {
      corrections: corrections.map((correction) => ({
        id: correction.id,
        organizationName: organizationNames.get(correction.organizationId) ?? "Empresa removida",
        userName: userNames.get(correction.userId) ?? "Usuário removido",
        channel: correction.channel,
        userMessage: correction.userMessage,
        astroReply: correction.astroReply,
        route: correction.route,
        expected: correction.expected,
        status: correction.status,
        resolutionNote: correction.resolutionNote,
        transcript: toTranscript(correction.transcript),
        createdAt: correction.createdAt.toISOString(),
      })),
      total,
      openByRoute: openGroups
        .map((group) => ({ route: group.route ?? "sem rota", count: group._count._all }))
        .sort((first, second) => second.count - first.count),
    };
  });

export const updateAstroCorrectionStatus = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update ASTRO correction status", tags: ["Admin"] })
  .input(
    z.object({
      id: z.string(),
      status: z.enum(CORRECTION_STATUSES),
      resolutionNote: z.string().trim().max(1000).optional(),
    }),
  )
  .output(z.object({ id: z.string(), status: z.string() }))
  .handler(async ({ input, context }) => {
    const isClosing = input.status !== "OPEN";
    const updated = await prisma.astroCorrection.update({
      where: { id: input.id },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote || null,
        resolvedById: isClosing ? context.adminUser.id : null,
        resolvedAt: isClosing ? new Date() : null,
      },
      select: { id: true, status: true },
    });
    return updated;
  });

export const adminAstroCorrectionsRouter = {
  list: listAstroCorrections,
  updateStatus: updateAstroCorrectionStatus,
};
