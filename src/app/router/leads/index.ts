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

// 🟧 LIST ALL
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
        order: z.number(),
        createdAt: z.date(),
      }),
    })
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const lead = await prisma.$transaction(async (tx) => {
        // Verifica se o lead já existe
        const existingLead = await tx.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            order: true,
            createdAt: true,
          },
        });

        if (existingLead) {
          return existingLead;
        }

        // Busca o maior order da coluna com FOR UPDATE (lock pessimista)
        const lastLead = await tx.lead.findFirst({
          where: {
            statusId: input.statusId,
            trackingId: input.trackingId,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        const newOrder = lastLead !== null ? lastLead.order + 1 : 0;

        // Cria o novo lead
        return await tx.lead.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            trackingId: input.trackingId,
            order: newOrder,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            order: true,
            createdAt: true,
          },
        });
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
 * 🔵 Atualizar ordem e coluna (OTIMIZADO)
 * Lógica corrigida para evitar conflitos de order
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
      newOrder: z.number().int().min(0),
    })
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId, newOrder } = input;

    try {
      await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { id: true, statusId: true, order: true },
        });

        if (!lead) throw errors.NOT_FOUND;

        const oldStatusId = lead.statusId;
        const oldOrder = lead.order;
        const isChangingColumn = oldStatusId !== statusId;

        // CASO 1: Mudando de coluna
        if (isChangingColumn) {
          // 1.1: Fecha o espaço na coluna antiga
          await tx.lead.updateMany({
            where: {
              statusId: oldStatusId,
              order: { gt: oldOrder },
            },
            data: { order: { decrement: 1 } },
          });

          // 1.2: Abre espaço na nova coluna
          await tx.lead.updateMany({
            where: {
              statusId,
              order: { gte: newOrder },
            },
            data: { order: { increment: 1 } },
          });

          // 1.3: Move o lead
          await tx.lead.update({
            where: { id: leadId },
            data: { statusId, order: newOrder },
          });
        }
        // CASO 2: Mesma coluna
        else {
          // 2.1: Se não mudou de posição, não faz nada
          if (newOrder === oldOrder) {
            return;
          }

          // 2.2: Movendo para baixo (aumentando order)
          if (newOrder > oldOrder) {
            // Decrementa os leads entre a posição antiga e nova
            await tx.lead.updateMany({
              where: {
                statusId,
                order: { gt: oldOrder, lte: newOrder },
              },
              data: { order: { decrement: 1 } },
            });
          }
          // 2.3: Movendo para cima (diminuindo order)
          else {
            // Incrementa os leads entre a posição nova e antiga
            await tx.lead.updateMany({
              where: {
                statusId,
                order: { gte: newOrder, lt: oldOrder },
              },
              data: { order: { increment: 1 } },
            });
          }

          // 2.4: Move o lead
          await tx.lead.update({
            where: { id: leadId },
            data: { order: newOrder },
          });
        }
      });

      return { success: true };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
