import { PrismaClient, Temperature } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";
import "dotenv/config";
import z from "zod";
import { slugify } from "@/lib/utils";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const bubbleApiResponseSchema = z.object({
  status: z.string(),
  response: z.object({
    company: z.object({
      _id: z.string(),
      Nome_Empresa: z.string(),
      "Created Date": z.number(),
    }),
    trackings: z.array(z.any()),
    status: z.array(z.any()),
    leads: z.array(z.any()).optional(),
    tags: z.array(z.any()),
  }),
});
const mapColor = (color: string): string => {
  switch (color) {
    case "Azul":
      return "#1447e6";
    case "Laranja":
      return "#f97316";
    case "Verde":
      return "#22c55e";
    case "Vermelho":
      return "#ef4444";
    case "Amarelo ocre":
      return "#d1a110";
    case "Rosa":
      return "#ec4899";
    case "Lilás":
      return "#a855f7";
    case "Roxo":
      return "#7c3aed";
    default:
      return "#1447e6";
  }
};
const mapTemperature = (temp: string): Temperature => {
  switch (temp) {
    case "Morno":
      return "WARM";
    case "Quente":
      return "HOT";
    case "Frio":
      return "COLD";
    default:
      return "COLD";
  }
};

const trackingId = "cmm0zu8ib0000f4sliuby0q77";
const statusId = "cmm108n8q000jf4sl3ul5jdi8";
const statusId2 = "cmm0zu8ij0002f4sla8lzvw32";

const organizationCrescerId = "42RDntMnMdxd39qSgMyLhBjR1zupwWft";

const statusIds = [statusId, statusId2];

const tagsIds = [
  "cmm3y3hc7000204lbb7ra8e3h",
  "cmm3ufl5s000304l4rr115gps",
  "cmlzf4hzt000004jvoxabb4z9",
  "cmlzf82l2000104kyydcz556z",
  "cmm3y4o3p000304lbm9y5klo9",
];

async function main() {
  const email = "arthur.fabricyo@gmail.com";

  const response = await fetch(
    "https://nasago.bubbleapps.io/api/1.1/wf/integration-total",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar dados da API: ${response.statusText}`);
  }

  const json = await response.json();
  const result = bubbleApiResponseSchema.parse(json);
  const {
    company,
    trackings,
    status: statuses,
    tags: bubbleTags,
  } = result.response;

  let leads: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const leadsRes = await fetch(
      "https://nasago.bubbleapps.io/api/1.1/wf/integration-total-leads",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, page }),
      },
    );

    if (!leadsRes.ok) {
      if (page === 1) {
        throw new Error(
          `Erro ao buscar leads da API (Página ${page}): ${leadsRes.statusText}`,
        );
      }
      break;
    }

    const leadsJson = await leadsRes.json();
    const pageLeads = leadsJson.response?.leads;

    if (Array.isArray(pageLeads) && pageLeads.length > 0) {
      leads = [...leads, ...pageLeads];
      page++;
    } else {
      hasMore = false;
    }

    if (page > 500) break; // Safety limit
  }

  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          email,
          members: { some: { organizationId: organizationCrescerId } },
        },
        include: {
          members: true,
        },
      });

      if (!user || !user.members[0]) {
        throw new Error("Usuário não encontrado");
      }
      const upsertedTrackingIds = new Set(trackings.map((t) => t._id));
      const upsertedStatusIds = new Set(statuses.map((s) => s._id));

      const organization = await tx.organization.findUnique({
        where: { id: organizationCrescerId },
      });

      if (!organization) {
        throw new Error("Organização não encontrada");
      }

      for (const t of trackings) {
        await tx.tracking.upsert({
          where: { id: t._id },
          update: {
            name: t.title || "Sem nome",
            globalAiActive: t.global_ai_active || false,
            updatedAt: t["Modified Date"]
              ? new Date(t["Modified Date"])
              : new Date(),
          },
          create: {
            id: t._id,
            name: t.title || "Sem nome",
            organizationId: organization.id,
            globalAiActive: t.global_ai_active || false,
            createdAt: t["Created Date"]
              ? new Date(t["Created Date"])
              : new Date(),
          },
        });
        await tx.trackingParticipant.upsert({
          where: {
            userId_trackingId: {
              userId: user.id,
              trackingId: t._id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            trackingId: t._id,
            role: "OWNER", // Or "MEMBER", depending on preference. Assuming OWNER for integration init.
          },
        });
      }
      for (const s of statuses) {
        if (!s.tracking) {
          console.warn(
            `Pulando status ${s._id}: trackingId ${s.tracking} Status não possui tracking.`,
          );
          continue;
        }
        if (!upsertedTrackingIds.has(s.tracking)) {
          console.warn(
            `Pulando status ${s._id}: trackingId ${s.tracking} não encontrado no payload.`,
          );
          continue;
        }

        await tx.status.upsert({
          where: { id: s._id },
          update: {
            name: s.title || "Sem nome",
            color: s.color ? mapColor(s.color) : "#1447e6",
            order: s.order || 0,
            updatedAt: s["Modified Date"]
              ? new Date(s["Modified Date"])
              : new Date(),
          },
          create: {
            id: s._id,
            name: s.title || "Sem nome",
            color: s.color ? mapColor(s.color) : "#1447e6",
            order: s.order || 0,
            trackingId: s.tracking,
            createdAt: s["Created Date"]
              ? new Date(s["Created Date"])
              : new Date(),
          },
        });
      }

      // UPSERT TAGS
      for (const tag of bubbleTags) {
        // Tag doesn't strictly depend on Status, but check Tracking
        if (tag.tracking && !upsertedTrackingIds.has(tag.tracking)) {
          console.warn(
            `Tag ${tag._id} referencia tracking ${tag.tracking} inexistente.`,
          );
        }

        const tagSlug = slugify(tag.name);
        await tx.tag.upsert({
          where: { id: tag._id },
          update: {
            name: tag.name,
            slug: tagSlug,
            color: tag.cor_fundo ? mapColor(tag.cor_fundo) : "#1447e6",
          },
          create: {
            id: tag._id,
            name: tag.name,
            slug: tagSlug,
            color: tag.cor_fundo ? mapColor(tag.cor_fundo) : "#1447e6",
            organizationId: organization.id,
            trackingId: tag.tracking || null,
          },
        });
      }
      const upsertedTagIds = new Set(bubbleTags.map((t) => t._id));

      for (const lead of leads) {
        const cleanPhone = lead.phone
          ? lead.phone.toString().replace(/\D/g, "")
          : null;

        if (!cleanPhone) {
          console.warn(
            `Lead ${lead._id} ignorado: Telefone não informado ou inválido.`,
          );
          continue;
        }

        lead.phone = cleanPhone;

        if (!lead.tracking || !upsertedTrackingIds.has(lead.tracking)) {
          console.warn(
            `Lead ${lead._id} ignorado: Tracking ${lead.tracking} não encontrado.`,
          );
          continue;
        }
        if (!lead.status_person || !upsertedStatusIds.has(lead.status_person)) {
          console.warn(
            `Lead ${lead._id} ignorado: Status ${lead.status_person} não encontrado.`,
          );
          continue;
        }

        const existingByPhone = await tx.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: lead.phone,
              trackingId: lead.tracking,
            },
          },
        });

        if (existingByPhone && existingByPhone.id !== lead._id) {
          console.warn(
            `Lead ${lead._id} ignorado: Conflito de telefone (${lead.phone}) no funil ${lead.tracking}.`,
          );
          continue;
        }

        const statusExists = await tx.status.findUnique({
          where: { id: lead.status_person },
        });

        if (!statusExists) {
          console.error(
            `STATUS NÃO EXISTE: ${lead.status_person} | Lead: ${lead._id}`,
          );
          continue;
        }

        const leadRecord = await tx.lead.upsert({
          where: { id: lead._id },
          update: {
            name: lead.name || "Sem nome",
            email: lead.email || null,
            phone: lead.phone,
            temperature: mapTemperature(lead.temperatura),
            statusId: lead.status_person,
            updatedAt: lead["Modified Date"]
              ? new Date(lead["Modified Date"])
              : new Date(),
          },
          create: {
            id: lead._id,
            name: lead.name || "Sem nome",
            email: lead.email || null,
            phone: lead.phone,
            temperature: mapTemperature(lead.temperatura),
            statusId: lead.status_person,
            trackingId: lead.tracking,
            createdAt: lead["Created Date"]
              ? new Date(lead["Created Date"])
              : new Date(),
          },
        });

        let leadTagIds: string[] = [];
        if (Array.isArray(lead.tag_refer)) {
          leadTagIds = lead.tag_refer;
        } else if (typeof lead.tag_refer === "string") {
          leadTagIds = lead.tag_refer.split(",").map((id: string) => id.trim());
        }

        for (const tagId of leadTagIds) {
          if (upsertedTagIds.has(tagId)) {
            await tx.leadTag
              .upsert({
                where: {
                  leadId_tagId: {
                    leadId: leadRecord.id,
                    tagId: tagId,
                  },
                },
                update: {},
                create: {
                  leadId: leadRecord.id,
                  tagId: tagId,
                },
              })
              .catch(() =>
                console.warn(
                  `Falha ao vincular tag ${tagId} ao lead ${leadRecord.id}`,
                ),
              );
          }
        }

        /*
          // 2.5 Upsert Conversation and Messages if lead has a conversation linked
          if (
            lead.conversation &&
            messagesByConversation.has(lead.conversation)
          ) {
            const convId = lead.conversation;
            await tx.conversation.upsert({
              where: { id: convId },
              update: {
                isActive: true,
                trackingId: lead.tracking,
              },
              create: {
                id: convId,
                leadId: leadRecord.id,
                trackingId: lead.tracking,
                remoteJid: `${lead.phone}@s.whatsapp.net`,
                isActive: true,
              },
            });

            const messages = messagesByConversation.get(convId) || [];
            for (const msg of messages) {
              if (!msg.message) continue;
              await tx.message.upsert({
                where: { messageId: msg._id },
                update: {
                  body: msg.message,
                  fromMe: msg.fromMe ?? false,
                  createdAt: msg["Created Date"]
                    ? new Date(msg["Created Date"])
                    : new Date(),
                },
                create: {
                  messageId: msg._id,
                  body: msg.message,
                  fromMe: msg.fromMe ?? false,
                  conversationId: convId,
                  createdAt: msg["Created Date"]
                    ? new Date(msg["Created Date"])
                    : new Date(),
                },
              });
            }
          }
          */
      }
    },
    {
      timeout: 60000,
    },
  );
  console.log("Seed completed successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// for (let i = 1; i <= 100; i++) {
//   const randomStatusId = faker.helpers.arrayElement(statusIds);
//   const phone = `852146${i.toString().padStart(8, "0")}`;

//   const currentLead = await prisma.lead.create({
//     data: {
//       name: faker.person.firstName(),
//       statusId: randomStatusId,
//       trackingId,
//       phone,
//     },
//   });
//   await prisma.conversation.create({
//     data: {
//       leadId: currentLead.id,
//       remoteJid: `${currentLead.phone}`,
//       trackingId,
//     },
//   });
// }
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
