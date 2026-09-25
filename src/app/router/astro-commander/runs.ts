import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Execuções e fila de aprovação (spec 0023, RF-5 / RF-11). Alimenta a aba
 * Execuções do comando e a aba Aprovações da organização.
 */

const PAGE_SIZE = 30;

export const listRuns = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      commandId: z.string().optional(),
      status: z
        .enum([
          "RUNNING",
          "SUCCEEDED",
          "FAILED",
          "WAITING_APPROVAL",
          "SKIPPED_LIMIT",
          "SKIPPED",
        ])
        .optional(),
      limit: z.number().int().min(1).max(100).default(PAGE_SIZE),
    }),
  )
  .handler(async ({ context, input }) => {
    const runs = await prisma.astroCommandRun.findMany({
      where: {
        organizationId: context.org.id,
        commandId: input.commandId,
        status: input.status,
      },
      orderBy: { startedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        commandId: true,
        trigger: true,
        status: true,
        summary: true,
        tokensIn: true,
        tokensOut: true,
        starsCharged: true,
        pendingActionIds: true,
        error: true,
        startedAt: true,
        finishedAt: true,
        command: { select: { title: true, persona: true } },
      },
    });

    return {
      runs: runs.map((run) => ({
        ...run,
        commandTitle: run.command.title,
        persona: run.command.persona,
        durationMs: run.finishedAt
          ? run.finishedAt.getTime() - run.startedAt.getTime()
          : null,
      })),
    };
  });

export const getRun = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    const run = await prisma.astroCommandRun.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      include: { command: { select: { title: true, persona: true } } },
    });
    if (!run) throw new Error("Execução não encontrada");

    const pendingActions = run.pendingActionIds.length
      ? await prisma.astroPendingAction.findMany({
          where: { id: { in: run.pendingActionIds } },
          select: {
            id: true,
            actionType: true,
            summary: true,
            status: true,
            expiresAt: true,
          },
        })
      : [];

    return { run, pendingActions };
  });

/** Números do painel do comando e da visão geral (RF-12 / RF-19). */
export const getUsage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      commandId: z.string().optional(),
      days: z.number().int().min(1).max(90).default(7),
    }),
  )
  .handler(async ({ context, input }) => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const where = {
      organizationId: context.org.id,
      commandId: input.commandId,
      startedAt: { gte: since },
    };

    const [byStatus, totals, pendingApprovals] = await Promise.all([
      prisma.astroCommandRun.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.astroCommandRun.aggregate({
        where,
        _sum: { tokensIn: true, tokensOut: true, starsCharged: true },
        _count: { _all: true },
      }),
      prisma.astroPendingAction.count({
        where: {
          organizationId: context.org.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    const counts = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;
    const totalRuns = totals._count._all;
    const succeeded = counts.SUCCEEDED ?? 0;

    return {
      days: input.days,
      byDay: await buildDailySeries(where, since, input.days),
      totalRuns,
      succeeded,
      failed: counts.FAILED ?? 0,
      waitingApproval: counts.WAITING_APPROVAL ?? 0,
      skipped: (counts.SKIPPED ?? 0) + (counts.SKIPPED_LIMIT ?? 0),
      // Execução barrada por limite não entra na conta: ela não tentou.
      successRate: totalRuns > 0 ? succeeded / totalRuns : 0,
      tokens: (totals._sum.tokensIn ?? 0) + (totals._sum.tokensOut ?? 0),
      stars: totals._sum.starsCharged ?? 0,
      pendingApprovals,
    };
  });

/**
 * Série diária para o gráfico do painel. Os dias sem execução entram com zero:
 * sem isso a linha "pula" o dia vazio e sugere um volume que não houve.
 */
async function buildDailySeries(
  where: { organizationId: string; commandId?: string; startedAt: { gte: Date } },
  since: Date,
  days: number,
): Promise<Array<{ date: string; runs: number; stars: number }>> {
  const runs = await prisma.astroCommandRun.findMany({
    where,
    select: { startedAt: true, starsCharged: true },
    orderBy: { startedAt: "asc" },
  });

  const buckets = new Map<string, { runs: number; stars: number }>();
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(since.getTime() + offset * 24 * 60 * 60 * 1000);
    buckets.set(day.toISOString().slice(0, 10), { runs: 0, stars: 0 });
  }
  for (const run of runs) {
    const key = run.startedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.runs += 1;
    bucket.stars += run.starsCharged;
  }

  return [...buckets.entries()].map(([date, bucket]) => ({ date, ...bucket }));
}

/** Fila de aprovação da organização (RF-11). */
export const listApprovals = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
  .handler(async ({ context, input }) => {
    const approvals = await prisma.astroPendingAction.findMany({
      where: {
        organizationId: context.org.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: input?.limit ?? 50,
      select: {
        id: true,
        actionType: true,
        summary: true,
        payload: true,
        expiresAt: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    });

    // A proposta guarda o comando no payload; sem isso a fila não diz de onde
    // cada pedido veio.
    const commandIds = [
      ...new Set(
        approvals
          .map((approval) => (approval.payload as { commandId?: string })?.commandId)
          .filter((commandId): commandId is string => Boolean(commandId)),
      ),
    ];
    const commands = commandIds.length
      ? await prisma.astroCommand.findMany({
          where: { id: { in: commandIds } },
          select: { id: true, title: true, persona: true },
        })
      : [];
    const commandById = new Map(commands.map((command) => [command.id, command]));

    return {
      approvals: approvals.map((approval) => {
        const commandId = (approval.payload as { commandId?: string })?.commandId;
        const command = commandId ? commandById.get(commandId) : undefined;
        return {
          id: approval.id,
          actionType: approval.actionType,
          summary: approval.summary,
          expiresAt: approval.expiresAt,
          createdAt: approval.createdAt,
          requestedBy: approval.user?.name ?? null,
          commandId: commandId ?? null,
          commandTitle: command?.title ?? null,
        };
      }),
    };
  });
