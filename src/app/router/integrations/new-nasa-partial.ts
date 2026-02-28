import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

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

export const newNasaIntegrationPartial = base
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

    // 2. Perform database operations in a transaction
    await prisma.$transaction(async (tx) => {
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
    });

    return { message: "Integração realizada com sucesso" };
  });
