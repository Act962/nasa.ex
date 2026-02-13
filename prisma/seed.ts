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
const trackingId = "cmkfzj9w40000uwc11q5wq84i";
const statusId = "cmkfzj9w70002uwc1vxbmyo5n";
const statusId2 = "cmkfzj9w80004uwc1vhhvxemd";
const statusId3 = "cmkfzj9w80003uwc1jdxscpxu";

async function main() {
  const statusIds = [statusId, statusId2, statusId3];

  for (let i = 1; i <= 5000; i++) {
    const phone = `852146${i.toString().padStart(8, "0")}`;
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
