import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});
const USER_1_ID = "ktvLQ6eAI1oZO9xSdvKCyAQXCBs9ykmT";
const TRACKING_ID = "cmjmw5z3q0000t0vamxz21061";
const STATUS_ID = "cmjmw5z3t0002t0va559flygy";

async function main() {
  console.log("🚀 Iniciando seed de conversas...\n");

  // ========================================
  // 1. CRIAR LEADS
  // ========================================

  const conversations = [
    "cmkx0gvd90003jwvabv9m0t34",
    "cmkx0gvd80002jwvakfgelat9",
  ];

  console.log("💬 Criando conversas...");

  // ========================================
  // 3. CRIAR MENSAGENS (10 por conversa)
  // ========================================
  console.log("📨 Criando mensagens...");

  for (const conversation of conversations) {
    const messages = Array.from({ length: 10 }).map((_, index) => {
      const fromMe = index % 2 === 0;

      return {
        body: `Mensagem ${index + 1}`,
        messageId: randomUUID(),
        fromMe,
        status: "DELIVERED",
        conversationId: conversation,
        senderId: USER_1_ID,
      };
    });

    await prisma.message.createMany({
      data: messages,
    });
  }

  // ========================================
  // 4. RESUMO
  // ========================================
  console.log("\n═══════════════════════════════════");
  console.log("✅ Seed concluído com sucesso!");
  console.log("═══════════════════════════════════");
  console.log(`� Mensagens: ${conversations.length * 10}`);
  console.log("═══════════════════════════════════\n");
}

main();
