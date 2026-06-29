import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

/**
 * Lista o catálogo público de custos por ação (global, mesmo pra todas
 * as orgs). Usado pela coluna "Consumo" da tabela detalhada de
 * Atividades pra mostrar o custo de cada ação registrada.
 *
 * Retorna `Record<action, stars>` pra lookup O(1) no client.
 * Cacheável (staleTime alto) — só muda quando admin edita as regras.
 */
export const listStarActionCosts = base
  .use(requiredAuthMiddleware)
  .handler(async () => {
    const rules = await prisma.appStarCost.findMany({
      where: { category: "action" },
      select: { appSlug: true, monthlyCost: true, displayName: true },
    });

    const costs: Record<string, number> = {};
    const labels: Record<string, string> = {};
    for (const r of rules) {
      costs[r.appSlug] = r.monthlyCost;
      if (r.displayName) labels[r.appSlug] = r.displayName;
    }

    return { costs, labels };
  });
