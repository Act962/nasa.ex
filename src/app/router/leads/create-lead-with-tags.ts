import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createLeadWithTags = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().optional(),
      description: z.string().optional(),
      statusId: z.string(),
      trackingId: z.string(),
      position: z.enum(["first", "last"]).default("last"),
      tagIds: z.array(z.string()).optional(),
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      return await prisma.$transaction(async (tx) => {
        // Verificar se já existe
        const existingLead = await tx.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });

        if (existingLead) {
          return { lead: existingLead };
        }

        // Determinar ordem baseado na posição
        let newOrder: number;

        if (input.position === "first") {
          // Incrementar todos os outros
          await tx.lead.updateMany({
            where: {
              statusId: input.statusId,
              trackingId: input.trackingId,
            },
            data: { order: { increment: 1 } },
          });
          newOrder = 0;
        } else {
          // Buscar último
          const lastLead = await tx.lead.findFirst({
            where: {
              statusId: input.statusId,
              trackingId: input.trackingId,
            },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          newOrder = lastLead ? lastLead.order + 1 : 0;
        }

        // Criar lead
        const lead = await tx.lead.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            trackingId: input.trackingId,
            order: newOrder,
          },
        });

        // Adicionar tags se fornecidas
        if (input.tagIds && input.tagIds.length > 0) {
          await tx.leadTag.createMany({
            data: input.tagIds.map((tagId) => ({
              leadId: lead.id,
              tagId,
            })),
            skipDuplicates: true,
          });
        }

        return { lead };
      });
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
