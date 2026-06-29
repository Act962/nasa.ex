/**
 * Teste end-to-end do workflow ATENDIMENTO NEON — Fluxo Completo.
 *
 * O que faz:
 *   1. Cria um lead temporário "TESTE NEON [timestamp]" na tracking WEYDSON NEON
 *      com phone FAKE (não passa na validação BR — Evolution NÃO entrega).
 *   2. Dispara `agent-workflow/message-incoming` via Inngest com o texto NEON.
 *   3. Aguarda 30s pro workflow rodar (MENU → AI_DECISION → branch NEON →
 *      SEND_MESSAGE "Maravilha" + link do formulário).
 *   4. Lê leadMessage do banco e printa timeline ordenada.
 *   5. Não deleta (deixa pro user inspecionar no orbita).
 *
 * Como evita enviar WhatsApp real: phone "5500000000000" — Brazil phone
 * lib rejeita (não tem DDD válido + dígitos zeros). Workflow loga
 * messageBuffer mas o jobs/evolution-send falha silencioso.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { dispatchMessageIncoming } from "../src/features/workflows/lib/agent-trigger-helpers";

const TRACKING_ID = "cmq55s3tt099d0vulywhagly6"; // WEYDSON NEON
const WORKFLOW_ID = "yqknxfs0a9n7z5j4ecorgubk"; // ATENDIMENTO NEON — Fluxo Completo
const FAKE_PHONE = "5500000000000";
const NEON_MESSAGE = "Olá! Te conheci no evento NEON. Quero saber mais sobre a Plataforma NASA.";

async function main() {
  const tracking = await prisma.tracking.findUnique({
    where: { id: TRACKING_ID },
    select: { id: true, name: true, organizationId: true },
  });
  if (!tracking) throw new Error(`Tracking ${TRACKING_ID} não encontrado`);

  console.log(`✓ Tracking: ${tracking.name} (org=${tracking.organizationId})`);

  // Acha o status inicial (primeira coluna do kanban — menor ordem).
  const initialStatus = await prisma.status.findFirst({
    where: { trackingId: TRACKING_ID },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
  if (!initialStatus) throw new Error("Tracking sem status — não dá pra criar lead");
  console.log(`✓ Status inicial: ${initialStatus.name} (${initialStatus.id})`);

  const stamp = new Date().toISOString().slice(11, 19);
  const lead = await prisma.lead.create({
    data: {
      name: `TESTE NEON ${stamp}`,
      phone: FAKE_PHONE,
      trackingId: TRACKING_ID,
      statusId: initialStatus.id,
    },
  });
  console.log(`✓ Lead criado: ${lead.id} (phone fake ${FAKE_PHONE})`);

  // Workflow trigger é MESSAGE_INCOMING. Como esse fluxo NÃO tem
  // NEW_LEAD trigger, o lead em si não dispara nada — só o evento de
  // mensagem inbound. Vou disparar imediatamente.
  await dispatchMessageIncoming({
    leadId: lead.id,
    organizationId: tracking.organizationId,
    trackingId: TRACKING_ID,
    messageText: NEON_MESSAGE,
    messageId: `test-${Date.now()}`,
  });
  console.log(`✓ Evento dispatched: agent-workflow/message-incoming`);
  console.log(`  texto: "${NEON_MESSAGE}"`);

  console.log(`\n⏳ Aguardando 35s pro workflow rodar (inclui AI_DECISION + WAIT)...`);
  for (let i = 0; i < 7; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write(`  ${(i + 1) * 5}s ✓ `);
  }
  console.log();

  // Lê todas as mensagens geradas no chat desse lead. Message não tem
  // leadId direto — relaciona via Conversation (Conversation.leadId @unique).
  const messages = await prisma.message.findMany({
    where: { conversation: { leadId: lead.id } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromMe: true, body: true, mediaUrl: true, createdAt: true },
  });

  console.log(`\n=== Timeline (${messages.length} mensagens) ===`);
  for (const message of messages) {
    const arrow = message.fromMe ? "←" : "→";
    const text = (message.body ?? "").slice(0, 140);
    const time = message.createdAt.toISOString().slice(11, 19);
    console.log(`[${time}] ${arrow} ${text}${text.length === 140 ? "…" : ""}`);
  }

  // Lê tags aplicadas (Lead.leadTags → LeadTag → tag.name)
  const leadWithTags = await prisma.lead.findUnique({
    where: { id: lead.id },
    select: { leadTags: { select: { tag: { select: { name: true } } } } },
  });
  console.log(`\n=== Tags (${leadWithTags?.leadTags.length ?? 0}) ===`);
  for (const leadTag of leadWithTags?.leadTags ?? []) console.log(`  • ${leadTag.tag.name}`);

  console.log(`\n✓ Lead deixado vivo (id: ${lead.id}) — inspecione em:`);
  console.log(`  https://orbita.nasaex.com/tracking/${TRACKING_ID}/chat/${lead.id}`);
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
