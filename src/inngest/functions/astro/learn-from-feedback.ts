import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

/**
 * Aprender com o uso (spec 0028, RF-16).
 *
 * Uma vez por dia, cada correção escrita por alguém vira uma memória SUGERIDA.
 * Sugerida, nunca ativa: quem decide o que o ASTRO passa a seguir é um
 * administrador, na aba Auto Inteligência (D-6).
 *
 * A sugestão é o texto da correção, sem passar por modelo: quem escreveu já
 * disse o que era o certo, e reescrever isso com IA só afastaria da intenção.
 */

const BATCH_LIMIT = 200;

export const astroLearnFromFeedback = inngest.createFunction(
  { id: "astro-learn-from-feedback", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 0 7 * * *" },
  async ({ step }) => {
    const pending = await step.run("load-corrections", () =>
      prisma.astroFeedback.findMany({
        where: {
          processedAt: null,
          rating: "NEGATIVE",
          correction: { not: null },
        },
        orderBy: { createdAt: "asc" },
        take: BATCH_LIMIT,
        select: {
          id: true,
          organizationId: true,
          userId: true,
          correction: true,
          answerExcerpt: true,
        },
      }),
    );
    if (pending.length === 0) return { suggested: 0 };

    const suggested = await step.run("create-suggestions", async () => {
      let created = 0;
      for (const feedback of pending) {
        const content = feedback.correction?.trim();
        if (!content) continue;

        // Mesma correção duas vezes não vira duas sugestões.
        const existing = await prisma.astroMemory.findFirst({
          where: {
            organizationId: feedback.organizationId,
            content,
            status: { in: ["SUGGESTED", "ACTIVE"] },
          },
          select: { id: true },
        });
        if (existing) continue;

        await prisma.astroMemory.create({
          data: {
            organizationId: feedback.organizationId,
            kind: "RULE",
            content,
            status: "SUGGESTED",
            source: "FEEDBACK",
            sourceRef: feedback.id,
            createdById: feedback.userId,
          },
        });
        created += 1;
      }
      await prisma.astroFeedback.updateMany({
        where: { id: { in: pending.map((feedback) => feedback.id) } },
        data: { processedAt: new Date() },
      });
      return created;
    });

    return { processed: pending.length, suggested };
  },
);
