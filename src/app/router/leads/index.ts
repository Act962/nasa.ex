import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// 🟧 LIST ALL
export const listLeads = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all leads with optional filters, pagination, and sorting",
    tags: ["Leads"],
  })
  .input(
    z.object({
      statusId: z.string().optional(),
      trackingId: z.string().optional(),
      search: z.string().optional(), // busca por nome, email ou telefone
      page: z.number().default(1),
      limit: z.number().default(20),
      orderBy: z.enum(["createdAt", "updatedAt", "name"]).default("createdAt"),
      order: z.enum(["asc", "desc"]).default("desc"),
    })
  )
  .output(
    z.object({
      leads: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          phone: z.string().nullable(),
          email: z.string().nullable(),
          description: z.string().nullable(),
          statusId: z.string(),
          trackingId: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
        })
      ),
      total: z.number(),
      page: z.number(),
      totalPages: z.number(),
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      const { page, limit, statusId, trackingId, search, orderBy, order } =
        input;

      // filtros dinâmicos
      const where: any = {};

      if (statusId) where.statusId = statusId;
      if (trackingId) where.trackingId = trackingId;

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const total = await prisma.lead.count({ where });

      const leads = await prisma.lead.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        leads,
        total,
        page,
        totalPages,
      };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().optional(),
      description: z.string().optional(),
      statusId: z.string(),
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        createdAt: z.date(),
      }),
    })
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const lead = await prisma.lead.upsert({
        where: {
          phone_trackingId: {
            phone: input.phone,
            trackingId: input.trackingId,
          },
        },
        update: {}, // opcional: atualiza se já existir
        create: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          description: input.description,
          statusId: input.statusId,
          trackingId: input.trackingId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          description: true,
          statusId: true,
          trackingId: true,
          createdAt: true,
        },
      });

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// 🟦 UPDATE
export const updateLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update an existing lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      description: z.string().optional(),
      statusId: z.string().optional(),
    })
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      const leadExists = await prisma.lead.findUnique({
        where: { id: input.id },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      const lead = await prisma.lead.update({
        where: { id: input.id },
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          description: input.description,
          statusId: input.statusId,
        },
      });

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// 🟥 DELETE
export const deleteLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        // permite deletar por id OU pelo par (phone + trackingId)
        id: z.string().optional(),
        phone: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (data) => data.id || (data.phone && data.trackingId),
        "You must provide either 'id' or both 'phone' and 'trackingId'."
      )
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    try {
      let deletedLead;

      if (input.id) {
        deletedLead = await prisma.lead.delete({ where: { id: input.id } });
      } else if (input.phone && input.trackingId) {
        deletedLead = await prisma.lead.delete({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });
      }

      return { success: !!deletedLead };
    } catch (err: any) {
      if (err.code === "P2025") {
        // Prisma error: record not found
        throw errors.NOT_FOUND;
      }

      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// 🟨 GET
export const getLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Retrieve a lead by ID or by phone + trackingId",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        id: z.string().optional(),
        phone: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (data) => data.id || (data.phone && data.trackingId),
        "You must provide either 'id' or both 'phone' and 'trackingId'."
      )
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      let lead = null;

      if (input.id) {
        lead = await prisma.lead.findUnique({
          where: { id: input.id },
        });
      } else if (input.phone && input.trackingId) {
        lead = await prisma.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });
      }

      if (!lead) {
        throw errors.NOT_FOUND;
      }

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const addLeadFirst = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Add a lead as the first in the column (statusId)",
    tags: ["Kanban", "Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      statusId: z.string(),
    })
  )
  .output(z.object({ leadName: z.string() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId } = input;

    try {
      // Incrementa todos os leads da coluna EXCETO o que está sendo movido
      await prisma.lead.updateMany({
        where: {
          statusId,
          id: { not: leadId },
        },
        data: { order: { increment: 1 } },
      });

      // Coloca o lead como o primeiro
      const lead = await prisma.lead.update({
        where: { id: leadId },
        data: { statusId, order: 0 },
      });

      return { leadName: lead.name };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
/**
 * 🟡 Adicionar Lead como o último da coluna
 * Define o order como o maior + 1 dentro da coluna
 */
export const addLeadLast = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Add a lead as the last in the column (statusId)",
    tags: ["Kanban", "Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      statusId: z.string(),
    })
  )
  .output(z.object({ leadName: z.string() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId } = input;

    try {
      // Busca o maior order da coluna
      const lastLead = await prisma.lead.findFirst({
        where: { statusId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const newOrder = lastLead ? lastLead.order + 1 : 0;

      const lead = await prisma.lead.update({
        where: { id: leadId },
        data: { statusId, order: newOrder },
      });

      return { leadName: lead.name };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

/**
 * 🔵 Atualizar ordem e coluna (drag & drop)
 * O usuário pode mover um lead para qualquer posição/coluna.
 */
export const updateLeadOrder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update lead order and column position in the Kanban",
    tags: ["Kanban", "Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      statusId: z.string(),
      newOrder: z.number(),
    })
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId, newOrder } = input;

    try {
      await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
        });

        if (!lead) throw errors.NOT_FOUND;

        const oldStatusId = lead.statusId;

        // Atualiza o lead
        await tx.lead.update({
          where: { id: leadId },
          data: { statusId, order: newOrder },
        });

        // Reordena a coluna antiga se mudou de coluna
        if (oldStatusId !== statusId) {
          const oldLeads = await tx.lead.findMany({
            where: { statusId: oldStatusId },
            orderBy: { order: "asc" },
          });

          for (let i = 0; i < oldLeads.length; i++) {
            await tx.lead.update({
              where: { id: oldLeads[i].id },
              data: { order: i },
            });
          }
        }

        // Sempre reordena a coluna de destino
        const newLeads = await tx.lead.findMany({
          where: { statusId },
          orderBy: { order: "asc" },
        });

        for (let i = 0; i < newLeads.length; i++) {
          await tx.lead.update({
            where: { id: newLeads[i].id },
            data: { order: i },
          });
        }
      });

      return { success: true };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

//   /** 🔄 Função auxiliar: renumera leads em um status (coluna) */
// async function normalizeLeadOrder(statusId: string) {
//   const leads = await prisma.lead.findMany({
//     where: { statusId },
//     orderBy: { order: "asc" },
//   });

//   for (let i = 0; i < leads.length; i++) {
//     if (leads[i].order !== i) {
//       await prisma.lead.update({
//         where: { id: leads[i].id },
//         data: { order: i },
//       });
//     }
//   }
// }
