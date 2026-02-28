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

const trackingId = "cmlzeylpd000004l2gljenmje";
const statusId = "cmm24g8sf000004l2mtwbddy1";
const statusId2 = "cmlzeylwc000304l2q2n1qgxv";
const statusId3 = "cmlzeylwc000404l211luhopf";
const statusId4 = "cmm4tvhu8000004lhlqrvkf5m";
const statusId5 = "cmm4tvqjd000004juisryljd9";
const statusId6 = "cmm4tvvif000104lhlmba2e5d";
const statusId7 = "cmm4tw2yv000104ju89gzr1qf";

const statusIds = [
  statusId,
  statusId2,
  statusId3,
  statusId4,
  statusId5,
  statusId6,
  statusId7,
];

const tagsIds = [
  "cmm3y3hc7000204lbb7ra8e3h",
  "cmm3ufl5s000304l4rr115gps",
  "cmlzf4hzt000004jvoxabb4z9",
  "cmlzf82l2000104kyydcz556z",
  "cmm3y4o3p000304lbm9y5klo9",
];

// async function main() {
//   await prisma.conversation.deleteMany({
//     where: {
//       trackingId,
//     },
//   });
//   await prisma.lead.deleteMany({
//     where: {
//       trackingId,
//     },
//   });
// }

async function main() {
  for (let i = 1; i <= 10000; i++) {
    const phone = `852146${i.toString().padStart(8, "0")}`;
    const randomStatusId = faker.helpers.arrayElement(statusIds);
    const randomTagsIds = faker.helpers.arrayElements(tagsIds, {
      min: 1,
      max: 5,
    });

    const lead = await prisma.lead.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone,
        statusId: randomStatusId,
        trackingId: trackingId,
        order: i,
        leadTags: {
          create: randomTagsIds.map((tagId) => ({
            tag: {
              connect: {
                id: tagId,
              },
            },
          })),
        },
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
