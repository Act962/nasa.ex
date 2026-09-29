/**
 * Regras globais padrão dos alertas proativos do ASTRO (spec 0029).
 *
 * Globais (`organizationId` nulo) valem para todas as organizações, que podem
 * desligar pela tela de Automações. Idempotente: regra que já existe não é
 * recriada nem alterada.
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/seed-astro-alert-rules.ts          # só mostra
 *   npx tsx --conditions=react-server scripts/seed-astro-alert-rules.ts --apply  # grava
 */

import "dotenv/config";
import prisma from "../src/lib/prisma";

/** Marca as regras criadas por este script, para localizar e remover depois. */
const SEED_AUTHOR = "SYSTEM:astro-0029";

const DEFAULT_RULES = [
  {
    eventType: "chat.lead_calling",
    name: "ASTRO — lead chamando",
    description: "Um lead mandou mensagem e está esperando alguém.",
    severity: "info",
    audience: { kind: "lead_responsible_or_admins" },
    params: {},
  },
  {
    eventType: "chat.lead_waiting",
    name: "ASTRO — lead esperando resposta",
    description: "Um lead está há alguns minutos sem resposta.",
    severity: "warning",
    audience: { kind: "lead_responsible_or_admins" },
    params: { waitingMinutes: 5 },
  },
  {
    eventType: "payment.expense_due_today",
    name: "ASTRO — despesa vence hoje",
    description: "Uma conta a pagar vence hoje e ainda não foi paga.",
    severity: "warning",
    audience: { kind: "org_admins" },
    params: {},
  },
  {
    eventType: "forge.contract_expiring",
    name: "ASTRO — contrato vencendo",
    description: "Um contrato ou proposta está perto do vencimento.",
    severity: "info",
    audience: { kind: "org_admins" },
    params: { daysBefore: 7 },
  },
] as const;

async function main() {
  const shouldApply = process.argv.includes("--apply");
  console.log(shouldApply ? "Modo: GRAVAR" : "Modo: só mostrar (use --apply para gravar)");

  for (const rule of DEFAULT_RULES) {
    const existing = await prisma.alertRule.findFirst({
      where: { eventType: rule.eventType, organizationId: null, createdBy: SEED_AUTHOR },
      select: { id: true, isActive: true },
    });

    if (existing) {
      console.log(`= ${rule.eventType}: já existe (${existing.id}, ativa=${existing.isActive})`);
      continue;
    }

    if (!shouldApply) {
      console.log(`+ ${rule.eventType}: seria criada (${rule.audience.kind})`);
      continue;
    }

    const created = await prisma.alertRule.create({
      data: {
        organizationId: null,
        name: rule.name,
        description: rule.description,
        eventType: rule.eventType,
        params: rule.params,
        severity: rule.severity,
        audience: rule.audience,
        channels: ["in_app"],
        // O orb e o widget do ASTRO são a superfície; toast/popup seriam ruído.
        displaySurface: "bell",
        isActive: true,
        createdBy: SEED_AUTHOR,
      },
      select: { id: true },
    });
    console.log(`+ ${rule.eventType}: criada (${created.id})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
