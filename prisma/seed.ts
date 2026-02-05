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

const userId = "ktvLQ6eAI1oZO9xSdvKCyAQXCBs9ykmT";
const trackingId = "cmjmw5z3q0000t0vamxz21061";
const statusId = "cmjmw5z3t0002t0va559flygy";

async function main() {
  for (let i = 1; i <= 100; i++) {
    const phone = `55119${i.toString().padStart(8, "0")}`;
    const name = `Lead Teste ${i}`;

    const lead = await prisma.lead.create({
      data: {
        name,
        email: `lead${i}@exemplo.com`,
        phone,
        statusId: statusId,
        trackingId: trackingId,
        responsibleId: userId,
        order: i,
      },
    });

    await prisma.conversation.create({
      data: {
        remoteJid: `${phone}@s.whatsapp.net`,
        leadId: lead.id,
        trackingId: trackingId,
        name: name,
      },
    });
  }
}
main();
