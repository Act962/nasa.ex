/**
 * Lista runs + métricas agregadas de um workflow em Modo Agente IA.
 *
 * Usado pelo Sheet "AgentDetail" no canvas: aba Histórico mostra a
 * lista de runs com status + duração, aba Métricas mostra agregados
 * (taxa de sucesso, Stars gastos, decisões IA, conversões).
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listWorkflowRuns = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .handler(async ({ input }) => {
    const runs = await prisma.workflowRun.findMany({
      where: { workflowId: input.workflowId },
      orderBy: { startedAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        triggerType: true,
        leadId: true,
        status: true,
        nodesExecuted: true,
        starsSpent: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    // Métricas agregadas (últimos 30 dias)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const all = await prisma.workflowRun.findMany({
      where: {
        workflowId: input.workflowId,
        startedAt: { gte: thirtyDaysAgo },
      },
      select: {
        status: true,
        starsSpent: true,
        nodesExecuted: true,
        startedAt: true,
        finishedAt: true,
      },
    });

    const totalRuns = all.length;
    const successCount = all.filter((r) => r.status === "SUCCESS").length;
    const failedCount = all.filter(
      (r) => r.status === "FAILED" || r.status === "MAX_EXECUTIONS_HIT",
    ).length;
    const suspendedCount = all.filter((r) => r.status === "SUSPENDED").length;
    const totalStars = all.reduce((s, r) => s + (r.starsSpent ?? 0), 0);
    const totalNodes = all.reduce((s, r) => s + (r.nodesExecuted ?? 0), 0);

    // Taxa de uso por hora (sliding window)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const runsLastHour = all.filter((r) => r.startedAt >= oneHourAgo).length;

    return {
      runs,
      metrics: {
        totalRuns,
        successCount,
        failedCount,
        suspendedCount,
        successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
        totalStars,
        totalNodes,
        avgNodesPerRun: totalRuns > 0 ? totalNodes / totalRuns : 0,
        runsLastHour,
      },
    };
  });

export const getWorkflowRunDetail = base
  .use(requiredAuthMiddleware)
  .input(z.object({ runId: z.string() }))
  .handler(async ({ input, errors }) => {
    const run = await prisma.workflowRun.findUnique({
      where: { id: input.runId },
      include: {
        nodeRuns: {
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
            chosenOutput: true,
            output: true,
            status: true,
            errorMessage: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });
    if (!run) throw errors.NOT_FOUND({ message: "Run não encontrada" });
    return run;
  });
