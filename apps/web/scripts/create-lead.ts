/**
 * Cria um lead num tracking + conversation. Idempotente: se já existe lead
 * com mesmo phone+trackingId, retorna o existente reativado.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import { createId } from "@paralleldrive/cuid2";
import prisma from "../src/lib/prisma";

async function main() {
  const trackingId = process.argv[2];
  const name = process.argv[3];
  const phone = process.argv[4];
  if (!trackingId || !name || !phone) {
    console.error("Uso: pnpm tsx scripts/create-lead.ts <trackingId> <name> <phone>");
    process.exit(1);
  }
  const t = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: { status: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
  });
  const statusId = t?.status[0]?.id;
  if (!statusId) {
    console.error("Tracking sem status");
    process.exit(1);
  }

  const existing = await prisma.lead.findFirst({
    where: { phone, trackingId },
  });
  let lead;
  if (existing) {
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { isActive: true, isArchived: false, archivedAt: null, statusFlow: "ACTIVE", name },
    });
    console.log(`✓ Lead já existia, reativado: ${lead.id} (${lead.name})`);
  } else {
    lead = await prisma.lead.create({
      data: {
        id: createId(),
        name,
        phone,
        trackingId,
        statusId,
        isActive: true,
        statusFlow: "ACTIVE",
      },
    });
    console.log(`✓ Lead criado: ${lead.id} (${lead.name})`);
  }

  // Conversation
  const conv = await prisma.conversation.findFirst({
    where: { leadId: lead.id, trackingId },
  });
  let convId: string;
  if (conv) {
    convId = conv.id;
    console.log(`Conversation reusada: ${conv.id}`);
  } else {
    const c = await prisma.conversation.create({
      data: {
        id: createId(),
        leadId: lead.id,
        trackingId,
        remoteJid: `${phone}@s.whatsapp.net`,
        isActive: true,
      },
    });
    convId = c.id;
    console.log(`✓ Conversation criada: ${c.id}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
