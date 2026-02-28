import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import type { Temperature } from "@/generated/prisma/enums";
import z from "zod";

const fiveMinutes = 5 * 60 * 1000;

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

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

export const newNasaIntegration = base
  .route({
    method: "POST",
    summary: "Integrate with NASA Bubble API",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      email: z.string().email("E-mail inválido"),
    }),
  )
  .handler(async ({ input }) => {
    const { email } = input;

    // 1. Fetch data from Bubble API
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

    // 1.1 Fetch leads from Paginated API
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

    // 1.2 Fetch messages for leads with conversations
    const messagesByConversation = new Map<string, any[]>();
    for (const lead of leads) {
      if (lead.conversation && !messagesByConversation.has(lead.conversation)) {
        const mRes = await fetch(
          "https://nasago.bubbleapps.io/api/1.1/wf/integration-total-messages-of-conversations/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversation: lead.conversation,
              page: 0,
            }),
          },
        );

        if (mRes.ok) {
          const mJson = await mRes.json();
          const pageMsgs = mJson.response?.messages;
          if (Array.isArray(pageMsgs)) {
            messagesByConversation.set(lead.conversation, pageMsgs);
          }
        }
      }
    }

    // 2. Perform database operations in a transaction
    await prisma.$transaction(
      async (tx) => {
        // Find if user exists to link as member
        const user = await tx.user.findUnique({
          where: { email },
        });

        const orgSlug = `${slugify(company.Nome_Empresa)}-${company._id.slice(-4)}`;

        // UPSERT ORGANIZATION
        const organization = await tx.organization.upsert({
          where: { id: company._id },
          update: {
            name: company.Nome_Empresa,
            slug: orgSlug,
          },
          create: {
            id: company._id,
            name: company.Nome_Empresa,
            slug: orgSlug,
            createdAt: new Date(company["Created Date"]),
          },
        });

        // LINK USER AS OWNER OF ORGANIZATION (if user exists)
        if (user) {
          await tx.member.upsert({
            where: {
              userId_organizationId: {
                userId: user.id,
                organizationId: organization.id,
              },
            },
            update: { role: "OWNER" },
            create: {
              userId: user.id,
              organizationId: organization.id,
              role: "OWNER",
              createdAt: new Date(),
            },
          });
        }

        // 1. Create a set of UPSERTED TRACKING IDs for validation
        const upsertedTrackingIds = new Set(trackings.map((t) => t._id));

        // UPSERT TRACKINGS
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

          // ADD USER AS PARTICIPANT TO THE TRACKING
          if (user) {
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
        }

        // UPSERT STATUSES
        // Filter out statuses that reference a non-existent tracking in the payload
        for (const s of statuses) {
          if (!s.tracking || !upsertedTrackingIds.has(s.tracking)) {
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

        const upsertedStatusIds = new Set(statuses.map((s) => s._id));
        const upsertedTagIds = new Set(bubbleTags.map((t) => t._id));

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
          if (
            !lead.status_person ||
            !upsertedStatusIds.has(lead.status_person)
          ) {
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
            leadTagIds = lead.tag_refer
              .split(",")
              .map((id: string) => id.trim());
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
        }
      },
      {
        timeout: fiveMinutes,
      },
    );

    return { message: "Integração realizada com sucesso" };
  });
