/**
 * Cadastra no catálogo de preço (`AppStarCost`) ações cujo valor JÁ foi decidido
 * pelo time, mas que nunca chegaram ao banco.
 *
 * Existe porque `prisma/seed-star-rules.ts` seeda as ~59 ações de uma vez, e
 * cadastrar em bloco passaria a cobrar ações que ainda não têm decisão de
 * negócio. Aqui a lista é explícita a cada execução — nada entra por acidente.
 *
 * NÃO inventa valor: só copia o que está em `PHASE_1_NEW_RULES`
 * (prisma/seed-star-rules.ts) ou em `DEFAULT_STAR_RULES` (src/data/star-rules.ts).
 * Ação sem valor em nenhum dos dois é recusada.
 *
 * Idempotente: não sobrescreve linha existente.
 *
 *   pnpm tsx scripts/seed-star-prices.ts astro_finance_document astro_finance_statement_pdf
 */

import "dotenv/config";

import { DEFAULT_STAR_RULES } from "../src/data/star-rules";
import prisma from "../src/lib/prisma";

/** Valores decididos fora de `DEFAULT_STAR_RULES`, espelhando prisma/seed-star-rules.ts. */
const PHASE_1_NEW_RULES: Record<string, { stars: number; label: string }> = {
  astro_prompt: { stars: 5, label: "Astro IA — prompt" },
  insights_report_ai: { stars: 10, label: "Insights — relatório com IA" },
  workflow_execute: { stars: 2, label: "Workflow executado" },
  nasa_route_video_upload_complete: {
    stars: 20,
    label: "NASA Route — vídeo de aula finalizado",
  },
  calendar_share_enable: { stars: 5, label: "Calendário público — ativação" },
};

function findDecidedValue(
  action: string,
): { stars: number; label: string; origin: string } | null {
  const phaseRule = PHASE_1_NEW_RULES[action];
  if (phaseRule) return { ...phaseRule, origin: "seed-star-rules.ts" };

  const defaultRule = DEFAULT_STAR_RULES.find((rule) => rule.action === action);
  if (defaultRule) {
    return {
      stars: defaultRule.stars,
      label: defaultRule.label,
      origin: "DEFAULT_STAR_RULES",
    };
  }
  return null;
}

async function main() {
  const actions = process.argv.slice(2);
  if (actions.length === 0) {
    console.error(
      "Informe ao menos uma chave de ação.\n" +
        "  pnpm tsx scripts/seed-star-prices.ts <acao> [<acao>...]",
    );
    process.exit(1);
  }

  for (const action of actions) {
    const decided = findDecidedValue(action);
    if (!decided) {
      console.log(
        `[RECUSADO] ${action} — nenhum valor decidido. Definir com o negócio antes.`,
      );
      continue;
    }

    const existing = await prisma.appStarCost.findUnique({
      where: { appSlug: action },
      select: { monthlyCost: true },
    });
    if (existing) {
      console.log(
        `[JÁ EXISTE] ${action} — ${existing.monthlyCost}★ no banco, mantido.`,
      );
      continue;
    }

    await prisma.appStarCost.create({
      data: {
        appSlug: action,
        monthlyCost: decided.stars,
        setupCost: 0,
        displayName: decided.label,
        category: "action",
        isPublic: true,
      },
    });
    console.log(
      `[CRIADO]   ${action} — ${decided.stars}★ (origem: ${decided.origin})`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
