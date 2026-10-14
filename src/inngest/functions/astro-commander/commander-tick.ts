/**
 * Tick do ASTRO Commander (spec 0028, RF-2 / RNF-1)
 *
 * Roda no ticker de 5 minutos (`crons/polling-tickers.ts`): um comando dispara
 * até 5 minutos depois do horário marcado. Pega os comandos vencidos e emite um evento
 * de execução por comando. O tick não executa nada: quem executa é
 * `astro/command.run`, que tem concorrência limitada por organização.
 */

import prisma from "@/lib/prisma";
import { computeNextRun } from "@/features/astro-commander/lib/cron";
import type { InlineStep } from "@/inngest/inline-step";

/** Teto por tick: uma fila enorme não pode estourar o tempo da função. */
const BATCH_LIMIT = 200;

export async function runAstroCommanderTick(step: InlineStep) {
  const now = new Date();

  const due = await step.run("carregar-comandos-vencidos", () =>
    prisma.astroCommand.findMany({
      where: {
        status: "ACTIVE",
        triggerType: { in: ["SCHEDULE", "ONCE"] },
        nextRunAt: { not: null, lte: now },
      },
      orderBy: { nextRunAt: "asc" },
      take: BATCH_LIMIT,
      select: {
        id: true,
        organizationId: true,
        triggerType: true,
        cron: true,
        timezone: true,
        nextRunAt: true,
      },
    }),
  );

  if (due.length === 0) return { disparados: 0 };

  // Reagenda ANTES de disparar: se a execução falhar, o comando não fica
  // preso repetindo o mesmo minuto a cada tick.
  await step.run("reagendar", async () => {
    for (const command of due) {
      if (command.triggerType === "ONCE") {
        await prisma.astroCommand.update({
          where: { id: command.id },
          data: { nextRunAt: null, status: "PAUSED", pausedReason: "Execução única concluída." },
        });
        continue;
      }
      // Servidor fora do ar acumula ticks perdidos: calculamos a partir de
      // AGORA, então roda uma vez só e não a fila inteira (CB-4).
      const next = command.cron
        ? computeNextRun(command.cron, command.timezone, now)
        : null;
      await prisma.astroCommand.update({
        where: { id: command.id },
        data: next
          ? { nextRunAt: next }
          : {
              nextRunAt: null,
              status: "PAUSED",
              pausedReason: "Agendamento inválido — revise o gatilho.",
            },
      });
    }
  });

  await step.sendEvent(
    "disparar-execucoes",
    due.map((command) => ({
      name: "astro/command.run",
      data: {
        commandId: command.id,
        organizationId: command.organizationId,
        trigger: "SCHEDULE" as const,
        // `step.run` serializa o resultado: o que volta aqui já é string.
        scheduledFor: new Date(command.nextRunAt ?? now).toISOString(),
      },
    })),
  );

  return { disparados: due.length };
}
