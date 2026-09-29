/**
 * Preços das ações novas da auditoria de lead (spec 0035) e do áudio do ASTRO
 * no WhatsApp (spec 0036). Só cria o que falta: preço editado no admin fica.
 *
 * Como rodar:
 *   pnpm tsx --conditions=react-server prisma/seed-astro-action-prices.ts
 */
import "../scripts/astro-qa/load-env";
import prisma from "../src/lib/prisma";

const ACTION_PRICES = [
  {
    appSlug: "lead_audit_ai",
    displayName: "Auditoria de lead por IA",
    description: "Só quando o cálculo em código tem pouca confiança — 2★ por auditoria.",
    monthlyCost: 2,
    isPublic: true,
  },
  {
    appSlug: "astro_bot_transcription",
    displayName: "ASTRO no WhatsApp — transcrição de áudio",
    description: "1★ por minuto de áudio, mínimo 1★, teto 100★.",
    monthlyCost: 0,
    isPublic: false,
    unit: "minute",
    unitCost: "1",
    unitDivisor: 1,
    minCharge: 1,
    maxCharge: 100,
  },
];

async function main() {
  for (const price of ACTION_PRICES) {
    const existing = await prisma.appStarCost.findUnique({ where: { appSlug: price.appSlug }, select: { id: true } });
    if (existing) {
      console.log(`= ${price.appSlug} já existe, mantido.`);
      continue;
    }
    await prisma.appStarCost.create({ data: { ...price, setupCost: 0, category: "action", allowBonus: true, isEnabled: true } });
    console.log(`+ ${price.appSlug} criado.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
