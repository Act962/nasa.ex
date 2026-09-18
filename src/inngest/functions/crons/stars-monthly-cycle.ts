/**
 * Cron: stars-monthly-cycle
 *
 * Roda diariamente às 06:00 UTC e renova o ciclo de Stars das organizações
 * cujo ciclo já passou de 30 dias: aplica rollover, credita a franquia do plano
 * e zera o consumo por membro.
 *
 * POR QUE ELE EXISTE
 * Não havia cron nenhum chamando `runMonthlyCycle`. As duas únicas chamadas
 * eram na primeira ativação do plano e na criação da organização — e a
 * propagação de plano ainda retorna antes de creditar quando o plano não muda.
 * Resultado medido no inventário de 2026-09-18: **todas as 12 organizações com
 * crédito tinham exatamente 1**, e uma do Earth estava há 94 dias sem o
 * segundo. Quem pagava recebia a franquia de um mês só. É o vazamento V1 do
 * docs/BILLING_ARCHITECTURE.md.
 *
 * DESLIGADO POR PADRÃO
 * Exige `STARS_MONTHLY_CYCLE_CRON=true`. Sem a variável, o cron roda em
 * simulação e apenas registra no log o que faria — inclusive quanto saldo seria
 * perdido pelo teto de rollover. Ligar é decisão de produto, tomada em cima do
 * relatório de `scripts/report-monthly-cycle.ts`.
 *
 * O CUIDADO QUE ESTA DECISÃO EXIGE
 * O ciclo capa o saldo que passa adiante em `rolloverPct` da franquia. As
 * organizações que acumularam saldo durante os meses em que o ciclo não rodou
 * **perdem o excedente** na primeira execução. Por isso a simulação vem antes.
 */

import { inngest } from "@/inngest/client";
import { runMonthlyCycle } from "@/features/stars/lib/star-service";
import prisma from "@/lib/prisma";

const CYCLE_DAYS = 30;

const isCronEnabled = () => process.env.STARS_MONTHLY_CYCLE_CRON === "true";

export const starsMonthlyCycle = inngest.createFunction(
  { id: "stars-monthly-cycle", retries: 1 },
  { cron: "0 6 * * *" }, // diariamente 06h UTC
  async ({ step }) => {
    const dryRun = !isCronEnabled();

    const due = await step.run("listar-organizacoes-com-ciclo-vencido", async () => {
      const threshold = new Date(
        Date.now() - CYCLE_DAYS * 24 * 60 * 60 * 1000,
      );
      return prisma.organization.findMany({
        where: {
          planId: { not: null },
          OR: [
            { starsCycleStart: null },
            { starsCycleStart: { lte: threshold } },
          ],
        },
        select: { id: true, name: true },
      });
    });

    if (due.length === 0) {
      return { dryRun, evaluated: 0, applied: 0, forfeitedTotal: 0 };
    }

    const results = await step.run("rodar-ciclo", async () => {
      const collected = [];
      for (const organization of due) {
        try {
          const result = await runMonthlyCycle(organization.id, { dryRun });
          collected.push({ name: organization.name, ...result });
        } catch (error) {
          console.error(
            `[stars-monthly-cycle] falhou para ${organization.name}`,
            error,
          );
        }
      }
      return collected;
    });

    const applied = results.filter((result) => result.applied);
    const forfeitedTotal = results.reduce(
      (total, result) => total + result.forfeited,
      0,
    );

    console.log(
      `[stars-monthly-cycle] ${dryRun ? "SIMULAÇÃO" : "APLICADO"} — ` +
        `${results.length} avaliada(s), ${applied.length} com ciclo renovado, ` +
        `${forfeitedTotal}★ perdidas pelo teto de rollover.`,
    );

    if (dryRun && forfeitedTotal > 0) {
      console.warn(
        "[stars-monthly-cycle] ligar o cron faria organizações perderem saldo " +
          "acumulado. Rode `pnpm tsx scripts/report-monthly-cycle.ts` e decida " +
          "antes de setar STARS_MONTHLY_CYCLE_CRON=true.",
      );
    }

    return {
      dryRun,
      evaluated: results.length,
      applied: applied.length,
      forfeitedTotal,
    };
  },
);
