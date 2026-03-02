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

const trackingId = "cmhtiltbu0001gk6g16gqybyv";
const statusId = "cmhwf3nmx0003gkp8svthw3tm";
const statusId2 = "cmhxef2sy0001gkiokbbs6nl3";

const statusIds = [statusId, statusId2];

const tagsIds = [
  "cmm3y3hc7000204lbb7ra8e3h",
  "cmm3ufl5s000304l4rr115gps",
  "cmlzf4hzt000004jvoxabb4z9",
  "cmlzf82l2000104kyydcz556z",
  "cmm3y4o3p000304lbm9y5klo9",
];

async function main() {
  for (let i = 1; i <= 100; i++) {
    const randomStatusId = faker.helpers.arrayElement(statusIds);
    const phone = `852146${i.toString().padStart(8, "0")}`;

    const currentLead = await prisma.lead.create({
      data: {
        name: faker.person.firstName(),
        statusId: randomStatusId,
        trackingId,
        phone,
      },
    });
    await prisma.conversation.create({
      data: {
        leadId: currentLead.id,
        remoteJid: `${currentLead.phone}`,
        trackingId,
      },
    });
  }
}
// async function main() {
//   for (let i = 1; i <= 10000; i++) {
//     const phone = `852146${i.toString().padStart(8, "0")}`;
//     const randomStatusId = faker.helpers.arrayElement(statusIds);
//     const randomTagsIds = faker.helpers.arrayElements(tagsIds, {
//       min: 1,
//       max: 5,
//     });

//     const lead = await prisma.lead.create({
//       data: {
//         name: faker.person.fullName(),
//         email: faker.internet.email(),
//         phone,
//         statusId: randomStatusId,
//         trackingId: trackingId,
//         order: i,
//         leadTags: {
//           create: randomTagsIds.map((tagId) => ({
//             tag: {
//               connect: {
//                 id: tagId,
//               },
//             },
//           })),
//         },
//       },
//     });

//     await prisma.conversation.create({
//       data: {
//         remoteJid: `${phone}@s.whatsapp.net`,
//         leadId: lead.id,
//         trackingId: trackingId,
//         name: lead.name,
//       },
//     });
//   }
// }
main();
