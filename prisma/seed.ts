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

const trackingId = "cmls7tv23000g6gvaupmz2suy";
const statusId = "cmls7tv27000i6gva9u17o5lb";
const statusId2 = "cmls7tv28000j6gvaip99jw86";
const statusId3 = "cmls7tv28000k6gvai86ikyq1";

// async function main() {
//   await prisma.conversation.deleteMany({});
//   await prisma.lead.deleteMany({});
// }

async function main() {
  const statusIds = [statusId, statusId2, statusId3];

  for (let i = 1; i <= 200; i++) {
    const phone = `1234567890${i.toString().padStart(8, "0")}`;
    const randomStatusId = faker.helpers.arrayElement(statusIds);

    await prisma.lead.create({
      data: {
        name: faker.person.firstName(),
        phone: phone,
        statusId: randomStatusId,
        trackingId: trackingId,
        conversation: {
          create: {
            trackingId: trackingId,
            remoteJid: `${phone}@s.whatsapp.net`,
            messages: {
              createMany: {
                data: {
                  messageId: `${phone}@s.whatsapp.net`,
                  createdAt: faker.date.past({
                    years: 1,
                    refDate: "2026-01-01",
                  }),
                  body: faker.lorem.sentence(),
                },
              },
            },
          },
        },
      },
    });
  }
}
main();
