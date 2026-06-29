import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const trackingId = process.argv[2];
  if (!trackingId) {
    console.error("Uso: pnpm tsx scripts/last-messages.ts <trackingId>");
    process.exit(1);
  }

  // Últimas 10 mensagens do tracking
  const messages = await prisma.message.findMany({
    where: { conversation: { trackingId } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      body: true,
      fromMe: true,
      messageId: true,
      senderName: true,
      createdAt: true,
      conversation: {
        select: {
          id: true,
          remoteJid: true,
          isActive: true,
          lead: {
            select: { id: true, name: true, phone: true, isActive: true },
          },
        },
      },
    },
  });

  console.log(`\n${messages.length} mensagens recentes em ${trackingId}:\n`);

  for (const m of messages) {
    console.log("──────────────────────────────────────────");
    console.log(
      `createdAt: ${m.createdAt.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour12: false,
      })} BRT (${m.createdAt.toISOString()} UTC)`,
    );
    console.log(`fromMe:    ${m.fromMe}`);
    console.log(`body:      ${m.body?.slice(0, 80) ?? "(vazio)"}`);
    console.log(`senderName:${m.senderName ?? "-"}`);
    console.log(`messageId: ${m.messageId}`);
    console.log(`Conversa:  ${m.conversation.id} (remote=${m.conversation.remoteJid}, active=${m.conversation.isActive})`);
    console.log(`Lead:      ${m.conversation.lead?.name} (${m.conversation.lead?.phone}) ativo=${m.conversation.lead?.isActive} id=${m.conversation.lead?.id}`);
  }
  console.log("──────────────────────────────────────────\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
