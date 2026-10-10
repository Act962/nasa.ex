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
    appSlug: "astro_attendance_setup_from_site",
    displayName: "ASTRO — montar o atendimento a partir do site",
    description: "5★ por leitura de site concluída (spec 0088). Preço inicial; ajuste pelo catálogo.",
    monthlyCost: 5,
    isPublic: false,
  },
  {
    appSlug: "astro_whatsapp_call_minute",
    displayName: "ASTRO no WhatsApp — chamada de voz (por minuto)",
    description: "2★ por minuto de chamada atendida pelo ASTRO (voz em tempo real). Preço inicial; ajuste pelo catálogo.",
    monthlyCost: 0,
    isPublic: false,
    unit: "minute",
    unitCost: "2",
    unitDivisor: 1,
    minCharge: 2,
    maxCharge: 4,
  },
  {
    appSlug: "astro_bot_speech",
    displayName: "ASTRO no WhatsApp — resposta em áudio",
    description: "1★ por minuto de áudio gerado, mínimo 1★, teto 10★.",
    monthlyCost: 0,
    isPublic: false,
    unit: "minute",
    unitCost: "1",
    unitDivisor: 1,
    minCharge: 1,
    maxCharge: 10,
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
