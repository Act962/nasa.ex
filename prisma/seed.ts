// import { PrismaClient, TagType, Temperature } from "@/generated/prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { faker } from "@faker-js/faker";

// import "dotenv/config";
// import z from "zod";

// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL,
// });

// const prisma = new PrismaClient({
//   adapter,
// });

// const userId = "42iJDVudyr0YcUxNiMACYdO6nOwi6NZD";
// const organizationId = "1763649065560x124190212952162300";

// async function main() {
//   const user = await prisma.user.findUnique({
//     where: {
//       id: userId,
//     },
//   });

//   if (!user) {
//     throw new Error("User not found");
//   }

//   const organization = await prisma.organization.findUnique({
//     where: {
//       id: organizationId,
//     },
//   });

//   if (!organization) {
//     throw new Error("Organization not found");
//   }

//   await prisma.member.create({
//     data: {
//       userId,
//       organizationId,
//       role: "admin",
//       createdAt: new Date(),
//     },
//   });
// }

// main();

// const bubbleApiResponseSchema = z.object({
//   status: z.string(),
//   response: z.object({
//     company: z.object({
//       _id: z.string(),
//       Nome_Empresa: z.string(),
//       "Created Date": z.number(),
//     }),
//     trackings: z.array(z.any()),
//     status: z.array(z.any()),
//     leads: z.array(z.any()).optional(),
//     tags: z.array(z.any()),
//   }),
// });
// const mapColor = (color: string): string => {
//   switch (color) {
//     case "Azul":
//       return "#1447e6";
//     case "Laranja":
//       return "#f97316";
//     case "Verde":
//       return "#22c55e";
//     case "Vermelho":
//       return "#ef4444";
//     case "Amarelo ocre":
//       return "#d1a110";
//     case "Rosa":
//       return "#ec4899";
//     case "Lilás":
//       return "#a855f7";
//     case "Roxo":
//       return "#7c3aed";
//     default:
//       return "#1447e6";
//   }
// };
// const mapTemperature = (temp: string): Temperature => {
//   switch (temp) {
//     case "Morno":
//       return "WARM";
//     case "Quente":
//       return "HOT";
//     case "Frio":
//       return "COLD";
//     default:
//       return "COLD";
//   }
// };

// const trackingId = "";
// const statusId = "cmmm52ssq000fdcva24esx1m4";
// const statusId2 = "cmmm52ssq000gdcvakvrrt2y4";

// const organizationBaseId = "SC158DipWUVooPXwMCVfzHWZKxlJA6Cp";

// const statusIds = [statusId, statusId2];

// const tagsIds = [
//   "cmm3y3hc7000204lbb7ra8e3h",
//   "cmm3ufl5s000304l4rr115gps",
//   "cmlzf4hzt000004jvoxabb4z9",
//   "cmlzf82l2000104kyydcz556z",
//   "cmm3y4o3p000304lbm9y5klo9",
// ];
import { PrismaClient, TagType, Temperature } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";

import "dotenv/config";
import z from "zod";
import { createId } from "@paralleldrive/cuid2";
import { slugify } from "@/utils/create-slug";

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

const trackingId = "";
const statusId = "cmmm52ssq000fdcva24esx1m4";
const statusId2 = "cmmm52ssq000gdcvakvrrt2y4";

const statusIds = [statusId, statusId2];

const tagsIds = [
  "cmm3y3hc7000204lbb7ra8e3h",
  "cmm3ufl5s000304l4rr115gps",
  "cmlzf4hzt000004jvoxabb4z9",
  "cmlzf82l2000104kyydcz556z",
  "cmm3y4o3p000304lbm9y5klo9",
];

// async function main() {
//   //   Mapas para manter referência entre IDs do Bubble e novos cuid()
//   const trackingIdMap = new Map<string, string>(); // bubbleId -> cuidId
//   const statusIdMap = new Map<string, string>(); // bubbleId -> cuidId
//   const tagIdMap = new Map<string, string>(); // bubbleId -> cuidId
//   const leadIdMap = new Map<string, string>(); // bubbleId -> cuidId
//   const conversationIdMap = new Map<string, string>(); // bubbleId -> cuidId

//   const email = "arthur.fabricyo@gmail.com";

//   const response = await fetch(
//     "https://nasago.bubbleapps.io/api/1.1/wf/integration-total",
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ email }),
//     },
//   );

//   if (!response.ok) {
//     throw new Error(`Erro ao buscar dados da API: ${response.statusText}`);
//   }

//   const json = await response.json();
//   const result = bubbleApiResponseSchema.parse(json);
//   const {
//     company,
//     trackings,
//     status: statuses,
//     tags: bubbleTags,
//   } = result.response;

//   let leads: any[] = [];
//   let page = 0;
//   let hasMore = true;

//   while (hasMore) {
//     const leadsRes = await fetch(
//       "https://nasago.bubbleapps.io/api/1.1/wf/integration-total-leads",
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ email, page }),
//       },
//     );

//     if (!leadsRes.ok) {
//       if (page === 1) {
//         throw new Error(
//           `Erro ao buscar leads da API (Página ${page}): ${leadsRes.statusText}`,
//         );
//       }
//       break;
//     }

//     const leadsJson = await leadsRes.json();
//     const pageLeads = leadsJson.response?.leads;

//     if (Array.isArray(pageLeads) && pageLeads.length > 0) {
//       leads = [...leads, ...pageLeads];
//       page++;
//     } else {
//       hasMore = false;
//     }

//     if (page > 500) break; // Safety limit
//   }

//   const messagesByConversation = new Map<string, any[]>();
//   for (const lead of leads) {
//     if (lead.conversation && !messagesByConversation.has(lead.conversation)) {
//       const mRes = await fetch(
//         "https://nasago.bubbleapps.io/api/1.1/wf/integration-total-messages-of-conversations/",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             conversation: lead.conversation,
//             page: 0,
//           }),
//         },
//       );

//       if (mRes.ok) {
//         const mJson = await mRes.json();
//         const pageMsgs = mJson.response?.messages;
//         if (Array.isArray(pageMsgs)) {
//           messagesByConversation.set(lead.conversation, pageMsgs);
//         }
//       }
//     }
//   }

//   await prisma.$transaction(
//     async (tx) => {
//       const user = await tx.user.findUnique({
//         where: {
//           email,
//           members: { some: { organizationId: organizationBaseId } },
//         },
//         include: {
//           members: true,
//         },
//       });

//       if (!user || !user.members[0]) {
//         throw new Error("Usuário não encontrado");
//       }
//       const upsertedTrackingIds = new Set(trackings.map((t) => t._id));
//       const upsertedStatusIds = new Set(statuses.map((s) => s._id));

//       const organization = await tx.organization.findUnique({
//         where: { id: organizationBaseId },
//       });

//       if (!organization) {
//         throw new Error("Organização não encontrada");
//       }

//       for (const t of trackings) {
//         const newTrackingId = createId();
//         trackingIdMap.set(t._id, newTrackingId);

//         await tx.tracking.upsert({
//           where: { id: newTrackingId },
//           update: {
//             name: t.title || "Sem nome",
//             globalAiActive: t.global_ai_active || false,
//             updatedAt: t["Modified Date"]
//               ? new Date(t["Modified Date"])
//               : new Date(),
//           },
//           create: {
//             id: newTrackingId,
//             name: t.title || "Sem nome",
//             organizationId: organization.id,
//             globalAiActive: t.global_ai_active || false,
//             createdAt: t["Created Date"]
//               ? new Date(t["Created Date"])
//               : new Date(),
//             aiSettings: {
//               create: {
//                 assistantName: "John",
//                 prompt: `Você é a assistente de IA da ${organization.name}`,
//                 finishSentence:
//                   "Quando o cliente quiser conversar com um consultou ou atendente humano",
//               },
//             },
//           },
//         });

//         await tx.trackingParticipant.upsert({
//           where: {
//             userId_trackingId: {
//               userId: user.id,
//               trackingId: newTrackingId,
//             },
//           },
//           update: {},
//           create: {
//             userId: user.id,
//             trackingId: newTrackingId,
//             role: "OWNER", // Or "MEMBER", depending on preference. Assuming OWNER for integration init.
//           },
//         });
//       }
//       for (const s of statuses) {
//         if (!s.tracking) {
//           console.warn(
//             `Pulando status ${s._id}: trackingId ${s.tracking} Status não possui tracking.`,
//           );
//           continue;
//         }
//         if (!upsertedTrackingIds.has(s.tracking)) {
//           console.warn(
//             `Pulando status ${s._id}: trackingId ${s.tracking} não encontrado no payload.`,
//           );
//           continue;
//         }

//         const newStatusId = createId();
//         const mappedTrackingId = trackingIdMap.get(s.tracking);

//         if (!mappedTrackingId) {
//           console.warn(`Pulando status ${s._id}: Tracking não foi mapeado.`);
//           continue;
//         }

//         statusIdMap.set(s._id, newStatusId);

//         await tx.status.upsert({
//           where: { id: newStatusId },
//           update: {
//             name: s.title || "Sem nome",
//             color: s.color ? mapColor(s.color) : "#1447e6",
//             order: s.order || 0,
//             updatedAt: s["Modified Date"]
//               ? new Date(s["Modified Date"])
//               : new Date(),
//           },
//           create: {
//             id: newStatusId,
//             name: s.title || "Sem nome",
//             color: s.color ? mapColor(s.color) : "#1447e6",
//             order: s.order || 0,
//             trackingId: mappedTrackingId,
//             createdAt: s["Created Date"]
//               ? new Date(s["Created Date"])
//               : new Date(),
//           },
//         });
//       }

//       // UPSERT TAGS
//       for (const tag of bubbleTags) {
//         // Tag doesn't strictly depend on Status, but check Tracking
//         if (tag.tracking && !upsertedTrackingIds.has(tag.tracking)) {
//           console.warn(
//             `Tag ${tag._id} referencia tracking ${tag.tracking} inexistente.`,
//           );
//         }

//         const newTagId = createId();
//         const mappedTrackingId = tag.tracking
//           ? trackingIdMap.get(tag.tracking)
//           : null;

//         tagIdMap.set(tag._id, newTagId);

//         const tagSlug = slugify(tag.name);
//         await tx.tag.upsert({
//           where: { id: newTagId },
//           update: {
//             name: tag.name,
//             slug: tagSlug,
//             color: tag.cor_fundo ? mapColor(tag.cor_fundo) : "#1447e6",
//           },
//           create: {
//             id: newTagId,
//             name: tag.name,
//             slug: tagSlug,
//             color: tag.cor_fundo ? mapColor(tag.cor_fundo) : "#1447e6",
//             organizationId: organization.id,
//             trackingId: mappedTrackingId || null,
//           },
//         });
//       }
//       const upsertedTagIds = new Set(bubbleTags.map((t) => t._id));

//       for (const lead of leads) {
//         const cleanPhone = lead.phone
//           ? lead.phone.toString().replace(/\D/g, "")
//           : null;

//         if (!cleanPhone) {
//           console.warn(
//             `Lead ${lead._id} ignorado: Telefone não informado ou inválido.`,
//           );
//           continue;
//         }

//         lead.phone = cleanPhone;

//         if (!lead.tracking || !upsertedTrackingIds.has(lead.tracking)) {
//           console.warn(
//             `Lead ${lead._id} ignorado: Tracking ${lead.tracking} não encontrado.`,
//           );
//           continue;
//         }
//         if (!lead.status_person || !upsertedStatusIds.has(lead.status_person)) {
//           console.warn(
//             `Lead ${lead._id} ignorado: Status ${lead.status_person} não encontrado.`,
//           );
//           continue;
//         }

//         const existingByPhone = await tx.lead.findUnique({
//           where: {
//             phone_trackingId: {
//               phone: lead.phone,
//               trackingId: trackingIdMap.get(lead.tracking)!,
//             },
//           },
//         });

//         if (existingByPhone && existingByPhone.id !== lead._id) {
//           console.warn(
//             `Lead ${lead._id} ignorado: Conflito de telefone (${lead.phone}) no funil ${lead.tracking}.`,
//           );
//           continue;
//         }

//         const mappedStatusId = statusIdMap.get(lead.status_person);
//         const mappedTrackingId = trackingIdMap.get(lead.tracking);

//         if (!mappedStatusId || !mappedTrackingId) {
//           console.error(
//             `IDs NÃO FORAM MAPEADOS: Status ${lead.status_person} -> ${mappedStatusId}, Tracking ${lead.tracking} -> ${mappedTrackingId}`,
//           );
//           continue;
//         }

//         const statusExists = await tx.status.findUnique({
//           where: { id: mappedStatusId },
//         });

//         if (!statusExists) {
//           console.error(
//             `STATUS NÃO EXISTE: ${mappedStatusId} | Lead: ${lead._id}`,
//           );
//           continue;
//         }

//         const newLeadId = createId();
//         leadIdMap.set(lead._id, newLeadId);

//         const leadRecord = await tx.lead.upsert({
//           where: { id: newLeadId },
//           update: {
//             name: lead.name || "Sem nome",
//             email: lead.email || null,
//             phone: lead.phone,
//             temperature: mapTemperature(lead.temperatura),
//             statusId: mappedStatusId,
//             updatedAt: lead["Modified Date"]
//               ? new Date(lead["Modified Date"])
//               : new Date(),
//           },
//           create: {
//             id: newLeadId,
//             name: lead.name || "Sem nome",
//             email: lead.email || null,
//             phone: lead.phone,
//             temperature: mapTemperature(lead.temperatura),
//             statusId: mappedStatusId,
//             trackingId: mappedTrackingId,
//             createdAt: lead["Created Date"]
//               ? new Date(lead["Created Date"])
//               : new Date(),
//           },
//         });

//         let leadTagIds: string[] = [];
//         if (Array.isArray(lead.tag_refer)) {
//           leadTagIds = lead.tag_refer;
//         } else if (typeof lead.tag_refer === "string") {
//           leadTagIds = lead.tag_refer.split(",").map((id: string) => id.trim());
//         }

//         for (const tagId of leadTagIds) {
//           const mappedTagId = tagIdMap.get(tagId);
//           if (mappedTagId) {
//             await tx.leadTag
//               .upsert({
//                 where: {
//                   leadId_tagId: {
//                     leadId: leadRecord.id,
//                     tagId: mappedTagId,
//                   },
//                 },
//                 update: {},
//                 create: {
//                   leadId: leadRecord.id,
//                   tagId: mappedTagId,
//                 },
//               })
//               .catch(() =>
//                 console.warn(
//                   `Falha ao vincular tag ${mappedTagId} ao lead ${leadRecord.id}`,
//                 ),
//               );
//           }
//         }

//         // 2.5 Upsert Conversation and Messages if lead has a conversation linked
//         if (
//           lead.conversation &&
//           messagesByConversation.has(lead.conversation)
//         ) {
//           const convId = lead.conversation;
//           const newConversationId = createId();
//           conversationIdMap.set(convId, newConversationId);

//           await tx.conversation.upsert({
//             where: { id: newConversationId },
//             update: {
//               isActive: true,
//               trackingId: mappedTrackingId,
//             },
//             create: {
//               id: newConversationId,
//               leadId: leadRecord.id,
//               trackingId: mappedTrackingId,
//               remoteJid: `${lead.phone}@s.whatsapp.net`,
//               isActive: true,
//             },
//           });

//           const messages = messagesByConversation.get(convId) || [];
//           for (const msg of messages) {
//             if (!msg.message) continue;
//             await tx.message.upsert({
//               where: { messageId: msg._id },
//               update: {
//                 body: msg.message,
//                 fromMe: msg.fromMe ?? false,
//                 createdAt: msg["Created Date"]
//                   ? new Date(msg["Created Date"])
//                   : new Date(),
//               },
//               create: {
//                 messageId: msg._id,
//                 status: "SEEN",
//                 body: msg.message,
//                 fromMe: msg.fromMe ?? false,
//                 conversationId: newConversationId,
//                 createdAt: msg["Created Date"]
//                   ? new Date(msg["Created Date"])
//                   : new Date(),
//               },
//             });
//           }
//         }
//       }
//     },
//     {
//       timeout: 10000000,
//     },
//   );
//   console.log("Seed completed successfully");
// }

// async function main() {
//   for (let i = 1; i <= 100; i++) {
//     const curentStatus = faker.helpers.arrayElement(statusIds);
//     const lead = await prisma.lead.create({
//       data: {
//         name: faker.person.firstName(),
//         phone: faker.phone.number({ style: "international" }),
//         statusId: curentStatus,
//         trackingId: "cmmm52ssl000cdcvafms0wa27",
//       },
//     });

//     const tag = await prisma.tag.create({
//       data: {
//         name: faker.lorem.slug(),
//         color: "#000000",
//         trackingId: "cmmm52ssl000cdcvafms0wa27",
//         slug: faker.lorem.slug(),
//         type: TagType.CUSTOM,
//         organizationId: "BLuCZMvTR4uDoSwcV7MVp8LyOPRIyslM",
//       },
//     });
//     await prisma.leadTag.create({
//       data: {
//         leadId: lead.id,
//         tagId: tag.id,
//       },
//     });
//   }
// }

const bubbleLeadsUrl =
  "https://nasago.bubbleapps.io/api/1.1/wf/integration-total-leads";
const email = "arthur.fabricyo@gmail.com";
const organizationBaseId = "SC158DipWUVooPXwMCVfzHWZKxlJA6Cp";

async function fetchBubbleLeads(page = 0): Promise<any[]> {
  const response = await fetch(bubbleLeadsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, page }),
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao buscar leads da API (página ${page}): ${response.statusText}`,
    );
  }

  const json = await response.json();
  const leads = json?.response?.leads;
  if (!Array.isArray(leads)) {
    return [];
  }
  return leads;
}

// async function main() {
//   console.log("Iniciando atualização de leads via Bubble...");

//   let page = 0;
//   let hasMore = true;
//   let updated = 0;

//   while (hasMore) {
//     const bubbleLeads = await fetchBubbleLeads(page);

//     if (bubbleLeads.length === 0) {
//       hasMore = false;
//       break;
//     }

//     for (const bubbleLead of bubbleLeads) {
//       const phone = normalizePhone(bubbleLead.phone);
//       if (!phone) {
//         console.warn(
//           `Ignorando lead sem telefone válido: ${JSON.stringify(bubbleLead)}`,
//         );
//         continue;
//       }

//       const existingLead = await prisma.lead.findFirst({
//         where: {
//           phone,
//           tracking: {
//             organizationId: organizationBaseId,
//           },
//         },
//       });

//       if (!existingLead) {
//         continue;
//       }

//       await prisma.lead.update({
//         where: { id: existingLead.id },
//         data: {
//           description: bubbleLead.observacoes ?? "",
//         },
//       });

//       updated++;
//     }

//     page += 1;

//     if (page >= 500) {
//       console.warn(
//         "Limite de páginas alcançado (500), interrompendo iteração.",
//       );
//       hasMore = false;
//     }
//   }

//   console.log(`Atualização concluída: ${updated} leads atualizados.`);
// }

const TRACKING_ID = "cmmz0saue0000iofdmztuwut2";
const STATUS_ID1 = "cmmz0sbc80002iofd3rrciy93";
const STATUS_ID2 = "cmmz0sbc80003iofdp1fhrxqw";
const STATUS_ID3 = "cmmz0sbc80004iofdpi3zxiq1";
const ORGANIZATION_ID = "Ao0EcD6nPDdtF0RhgRQDHtF2JkaPq0XC";

/**
 * Quantidades
 */
const TOTAL_LEADS = 100;
const TOTAL_TAGS = 10;

/**
 * Gera telefone único
 */
function generatePhone(index: number) {
  return `55${faker.string.numeric(10)}${index}`;
}

/**
 * Embaralhar array
 */
function shuffleArray<T>(array: T[]) {
  return array.sort(() => Math.random() - 0.5);
}

// async function main() {
//   console.log("🌱 Iniciando seed...");

//   /**
//    * 1 — Criar TAGS
//    */
//   console.log("Criando tags...");

//   const tagsData = Array.from({ length: TOTAL_TAGS }).map(() => ({
//     name: "tag" + faker.person.fullName(),
//     slug: "tag" + faker.person.fullName(),
//     color: faker.color.rgb(),
//     organizationId: ORGANIZATION_ID,
//     trackingId: TRACKING_ID,
//   }));

//   await prisma.tag.createMany({
//     data: tagsData,
//   });

//   const tags = await prisma.tag.findMany({
//     where: {
//       trackingId: TRACKING_ID,
//     },
//     select: {
//       id: true,
//     },
//   });

//   console.log(`✅ ${tags.length} tags criadas`);

//   /**
//    * 2 — Criar LEADS
//    */
//   console.log("Criando leads...");

//   const leadsData = Array.from({ length: TOTAL_LEADS }).map((_, i) => ({
//     name: faker.person.fullName(),
//     email: faker.internet.email(),
//     phone: generatePhone(i),
//     statusId: faker.helpers.arrayElement([STATUS_ID1, STATUS_ID2, STATUS_ID3]),
//     trackingId: TRACKING_ID,
//   }));

//   await prisma.lead.createMany({
//     data: leadsData,
//   });

//   const leads = await prisma.lead.findMany({
//     where: {
//       trackingId: TRACKING_ID,
//     },
//     select: {
//       id: true,
//     },
//   });

//   console.log(`✅ ${leads.length} leads criados`);

//   /**
//    * 3 — Embaralhar TAGS entre LEADS
//    */
//   console.log("Relacionando tags aos leads...");

//   const leadTagsData: {
//     leadId: string;
//     tagId: string;
//   }[] = [];

//   for (const lead of leads) {
//     const shuffledTags = shuffleArray([...tags]);

//     const numberOfTags = faker.number.int({
//       min: 1,
//       max: 3,
//     });

//     const selectedTags = shuffledTags.slice(0, numberOfTags);

//     for (const tag of selectedTags) {
//       leadTagsData.push({
//         leadId: lead.id,
//         tagId: tag.id,
//       });
//     }
//   }

//   await prisma.leadTag.createMany({
//     data: leadTagsData,
//     skipDuplicates: true,
//   });

//   console.log("✅ Tags vinculadas aos leads");

//   console.log("🎉 Seed finalizado com sucesso");
// }

async function main() {
  const a = await prisma.spacePointRule.findMany({
    where: {},
  });

  console.log(a);
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
