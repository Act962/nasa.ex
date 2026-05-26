import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { AiProvider, Prisma } from "@/generated/prisma/client";
import z from "zod";

// Resumo de uso da IA por tracking. Retorna:
// - totais (input/output/total tokens, runs, toolCalls)
// - série diária dos últimos N dias (default 30)
// - runs recentes (default 50)
export const getAiUsage = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      days: z.number().int().min(1).max(180).default(30),
      recentLimit: z.number().int().min(1).max(200).default(50),
      // "all"  → sem filtro
      // "NASA" → provider IS NULL (default da plataforma)
      // enum   → provider = <valor>
      provider: z
        .union([z.literal("all"), z.literal("NASA"), z.nativeEnum(AiProvider)])
        .default("all"),
    }),
  )
  .handler(async ({ input }) => {
    const { trackingId, days, recentLimit, provider } = input;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    // Filtro Prisma reaproveitado em totals / recent / daily.
    const providerFilter: Prisma.AiChatRunWhereInput =
      provider === "all"
        ? {}
        : provider === "NASA"
          ? { provider: null }
          : { provider };

    const where: Prisma.AiChatRunWhereInput = {
      trackingId,
      ...providerFilter,
    };

    // SQL extra pro $queryRaw — Prisma.sql interpola seguro.
    const providerSql =
      provider === "all"
        ? Prisma.sql``
        : provider === "NASA"
          ? Prisma.sql`AND provider IS NULL`
          : Prisma.sql`AND provider = ${provider}::"AiProvider"`;

    const [totals, dailyRaw, recent] = await Promise.all([
      prisma.aiChatRun.aggregate({
        where: { ...where, createdAt: { gte: since } },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          toolCalls: true,
        },
        _count: { _all: true },
      }),
      // Série diária: deixamos o Postgres agregar (date_trunc + SUM/COUNT)
      // pra não puxar todas as linhas e contar em JS — escala melhor com volume.
      prisma.$queryRaw<
        { day: Date; total_tokens: bigint; runs: bigint }[]
      >`
        SELECT
          date_trunc('day', created_at) AS day,
          SUM(total_tokens)::bigint AS total_tokens,
          COUNT(*)::bigint AS runs
        FROM ai_chat_run
        WHERE tracking_id = ${trackingId}
          AND created_at >= ${since}
          ${providerSql}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.aiChatRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: recentLimit,
        select: {
          id: true,
          provider: true,
          modelId: true,
          usingCustom: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          toolCalls: true,
          createdAt: true,
          leadId: true,
          conversationId: true,
        },
      }),
    ]);

    return {
      since,
      totals: {
        runs: totals._count._all,
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        toolCalls: totals._sum.toolCalls ?? 0,
      },
      daily: dailyRaw.map((d) => ({
        day: d.day,
        totalTokens: Number(d.total_tokens),
        runs: Number(d.runs),
      })),
      recent,
    };
  });
