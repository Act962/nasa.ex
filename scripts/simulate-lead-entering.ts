/**
 * Simula um lead entrando num tracking via chat — cria Lead + Conversation
 * e dispara o evento Inngest `workflow/execute.workflow` pros workflows
 * agentMode=true que escutam NEW_LEAD.
 *
 * Uso:
 *   pnpm tsx scripts/simulate-lead-entering.ts <trackingId> "<nome>" "<phone>"
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import { createId } from "@paralleldrive/cuid2";
import prisma from "../src/lib/prisma";
import { inngest } from "../src/inngest/client";

async function main() {
  const trackingId = process.argv[2];
  const name = process.argv[3] ?? "Lead Teste";
  const phone = process.argv[4] ?? `5511${Math.floor(900000000 + Math.random() * 99999999)}`;

  if (!trackingId) {
    console.error('Uso: pnpm tsx scripts/simulate-lead-entering.ts <trackingId> "<nome>" "<phone>"');
    process.exit(1);
  }

  const tracking = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      status: { orderBy: { order: "asc" }, take: 1, select: { id: true, name: true } },
    },
  });
  if (!tracking) {
    console.error(`Tracking ${trackingId} não encontrado`);
    process.exit(1);
  }
  const statusId = tracking.status[0]?.id;
  if (!statusId) {
    console.error(`Tracking sem statuses`);
    process.exit(1);
  }

  // 1. Cria o Lead
  const lead = await prisma.lead.create({
    data: {
      id: createId(),
      name,
      phone,
      trackingId: tracking.id,
      statusId,
      isActive: true,
      statusFlow: "ACTIVE",
    },
  });
  console.log(`✓ Lead criado:`);
  console.log(`  id:     ${lead.id}`);
  console.log(`  nome:   ${lead.name}`);
  console.log(`  phone:  ${lead.phone}`);
  console.log(`  status: ${tracking.status[0]?.name}`);

  // 2. Cria a Conversation (necessária pro chat aparecer)
  const conv = await prisma.conversation.create({
    data: {
      id: createId(),
      leadId: lead.id,
      trackingId: tracking.id,
      remoteJid: `${phone}@s.whatsapp.net`,
      isActive: true,
    },
  });
  console.log(`✓ Conversation criada: ${conv.id}`);

  // 3. Encontra workflows ativos com NEW_LEAD trigger nesse tracking
  const workflows = await prisma.workflow.findMany({
    where: {
      trackingId,
      isActive: true,
      nodes: { some: { type: "NEW_LEAD" as never } },
    },
    select: { id: true, name: true, agentMode: true },
  });
  console.log(`\nWorkflows que escutam NEW_LEAD:`);
  for (const w of workflows) {
    console.log(`  - ${w.name} (${w.id}, agentMode=${w.agentMode})`);
  }

  // 4. Dispara evento Inngest pra cada workflow (engine novo respeita
  //    workflow.agentMode internamente — workflows clássicos usam topo-sort)
  for (const wf of workflows) {
    await inngest.send({
      name: "workflow/execute.workflow",
      data: {
        workflowId: wf.id,
        triggerType: "NEW_LEAD",
        leadId: lead.id,
        initialData: {
          lead: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            trackingId: lead.trackingId,
            statusId: lead.statusId,
          },
        },
      },
    });
    console.log(`  → evento enviado pro Inngest pra ${wf.name}`);
  }

  console.log(`\n✓ Lead entrou. Acompanhe:`);
  console.log(`  Chat: /tracking-chat/${conv.id}?trackingId=${trackingId}`);
  console.log(`  Inngest dev: http://localhost:8288`);
  console.log(`  Run history: na aba "Histórico" do canvas do workflow`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
