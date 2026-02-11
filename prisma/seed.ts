import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const userId = "w9Q7KqTBaOGHL2CcvFOFlNpUgSaoqKJg";
const trackingId = "cmlf3qjk80001ywsl6vteyf8o";
const statusId = "cmlf3qjkg0003ywsl7b9axn32";
const statusId2 = "cmlf3qjkg0004ywslyqgjf477";
const statusId3 = "cmlf3qjkh0005ywsl653nwxcj";

async function main() {
  const statusIds = [statusId, statusId2, statusId3];

  for (let i = 1; i <= 5000; i++) {
    const phone = `956784${i.toString().padStart(8, "0")}`;
    const randomStatusId = faker.helpers.arrayElement(statusIds);

    const lead = await prisma.lead.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone,
        statusId: randomStatusId,
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
        name: lead.name,
      },
    });
  }
}
main();
