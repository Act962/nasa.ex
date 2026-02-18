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

const userId = "lglLGTaOXQtZmMWHFluooyGCLxkFVpfu";
const trackingId = "cmls7tv23000g6gvaupmz2suy";
const statusId = "cmkfzj9w70002uwc1vxbmyo5n";
const statusId2 = "cmkfzj9w80004uwc1vhhvxemd";
const statusId3 = "cmkfzj9w80003uwc1jdxscpxu";
const leadId = "cmlscvfzm00017sva12fkvrda";

async function main() {
  const statusIds = [statusId, statusId2, statusId3];

  for (let i = 1; i <= 200; i++) {
    const phone = `23123${i.toString().padStart(8, "0")}`;
    const randomStatusId = faker.helpers.arrayElement(statusIds);

    await prisma.message.create({
      data: {
        messageId: `${phone}@s.whatsapp.net`,
        createdAt: faker.date.past({
          years: 1,
          refDate: "2026-01-01",
        }),
        body: faker.lorem.sentence(),
        conversation: {
          connect: {
            trackingId: trackingId,
            leadId: leadId,
          },
        },
      },
    });
  }
}
main();
