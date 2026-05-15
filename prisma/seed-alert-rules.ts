/**
 * Seed de regras default do alert-engine.
 *
 * Cria regras globais (organizationId = null → aplica a todas orgs)
 * pra que o sistema seja útil out-of-the-box sem que cada Master configure.
 *
 * Roda assim:
 *   pnpm exec tsx prisma/seed-alert-rules.ts
 *
 * Idempotente: usa upsert por ID estável. Pode rodar várias vezes sem
 * duplicar.
 *
 * Regras criadas:
 *  1. agenda.reminder_fired → info+bell+action_participants
 *     (preserva comportamento do check-reminders.ts pré-engine)
 *  2. integration.whatsapp_down → critical+popup+org_admins
 *     (interrupção real — perde leads se WA tá fora)
 *  3. agenda.starting_soon (15min) → warning+toast+action_participants
 *  4. lead.stale (3 dias) → warning+toast+lead_responsible
 *     (proxy do "lead esquecido")
 *  5. forge.proposal_status_changed → info+bell+lead_responsible
 *     (informativo: status mudou)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

interface DefaultRule {
  id: string;
  name: string;
  description: string;
  eventType: string;
  params: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
  audience: { kind: string; userIds?: string[] };
  channels: string[];
  displaySurface: "bell" | "toast" | "popup";
  cooldownMinutes?: number;
}

const DEFAULTS: DefaultRule[] = [
  {
    id: "seed_agenda_reminder",
    name: "Lembrete de agenda (default)",
    description: "Lembrete agendado disparou — preserva fluxo legado.",
    eventType: "agenda.reminder_fired",
    params: {},
    severity: "info",
    audience: { kind: "action_participants" },
    channels: ["in_app", "whatsapp"],
    displaySurface: "bell",
  },
  {
    id: "seed_whatsapp_down",
    name: "WhatsApp desconectado há +1h",
    description:
      "Sua instância de WhatsApp está fora há mais de 1 hora. Reconecte pra não perder mensagens.",
    eventType: "integration.whatsapp_down",
    params: {},
    severity: "critical",
    audience: { kind: "org_admins" },
    channels: ["in_app"],
    displaySurface: "popup",
    cooldownMinutes: 60,
  },
  {
    id: "seed_agenda_starting_15",
    name: "Agenda começa em 15 minutos",
    description: "Você tem um agendamento começando em 15 minutos.",
    eventType: "agenda.starting_soon",
    params: { minutesBefore: 15 },
    severity: "warning",
    audience: { kind: "action_participants" },
    channels: ["in_app"],
    displaySurface: "toast",
  },
  {
    id: "seed_lead_stale_3d",
    name: "Lead sem contato há 3 dias",
    description:
      "Esse lead está ativo mas sem mensagem inbound há 3 dias. Considere resgatar.",
    eventType: "lead.stale",
    params: { days: 3 },
    severity: "warning",
    audience: { kind: "lead_responsible" },
    channels: ["in_app"],
    displaySurface: "toast",
  },
  {
    id: "seed_proposal_status_changed",
    name: "Proposta mudou de status",
    description:
      "Uma proposta atribuída a você mudou de status (criada/enviada/visualizada/paga/etc).",
    eventType: "forge.proposal_status_changed",
    params: {},
    severity: "info",
    audience: { kind: "lead_responsible" },
    channels: ["in_app"],
    displaySurface: "bell",
  },
];

async function main() {
  console.log(`[seed] sincronizando ${DEFAULTS.length} regras default...`);

  let created = 0;
  let updated = 0;
  for (const r of DEFAULTS) {
    const existing = await prisma.alertRule.findUnique({
      where: { id: r.id },
    });
    if (existing) {
      await prisma.alertRule.update({
        where: { id: r.id },
        data: {
          name: r.name,
          description: r.description,
          eventType: r.eventType,
          params: r.params as Prisma.InputJsonValue,
          severity: r.severity,
          audience: r.audience as Prisma.InputJsonValue,
          channels: r.channels as Prisma.InputJsonValue,
          displaySurface: r.displaySurface,
          cooldownMinutes: r.cooldownMinutes ?? null,
        },
      });
      updated++;
    } else {
      await prisma.alertRule.create({
        data: {
          id: r.id,
          organizationId: null, // global
          name: r.name,
          description: r.description,
          eventType: r.eventType,
          params: r.params as Prisma.InputJsonValue,
          severity: r.severity,
          audience: r.audience as Prisma.InputJsonValue,
          channels: r.channels as Prisma.InputJsonValue,
          displaySurface: r.displaySurface,
          isActive: true,
          createdBy: "SYSTEM",
          cooldownMinutes: r.cooldownMinutes ?? null,
        },
      });
      created++;
    }
  }

  console.log(`[seed] OK — ${created} criadas, ${updated} atualizadas.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed] ERRO:", err);
  process.exit(1);
});
